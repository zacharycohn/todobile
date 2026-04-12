package com.todobile

import android.Manifest
import android.content.Context
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.lifecycle.viewmodel.compose.viewModel
import java.io.File
import kotlin.math.max

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appConfig = AppConfig.fromBuildConfig()
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    if (appConfig.isComplete) {
                        ToDobileAndroidApp(appConfig)
                    } else {
                        MissingConfigScreen(appConfig)
                    }
                }
            }
        }
    }
}

private enum class RecorderUiState {
    Ready,
    Recording,
    Recorded,
    PermissionDenied,
}

private data class UploadSuccessState(
    val taskId: String,
    val taskDetails: String,
)

private enum class RecordingStopResult {
    Saved,
    TooShort,
    Failed,
}

@Composable
private fun ToDobileAndroidApp(appConfig: AppConfig) {
    val authViewModel: AuthViewModel = viewModel(factory = AuthViewModelFactory(appConfig))
    val authState by authViewModel.uiState.collectAsState()

    when {
        authState.loading -> LoadingScreen()
        authState.isSignedIn -> RecorderShell(
            userEmail = authState.userEmail,
            onSignOut = authViewModel::signOut,
            signOutInFlight = authState.submitting
        )
        else -> SignInScreen(
            state = authState,
            onEmailChanged = authViewModel::onEmailChanged,
            onPasswordChanged = authViewModel::onPasswordChanged,
            onSignIn = authViewModel::signIn
        )
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EFE8)),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = Color(0xFF1F5A46))
    }
}

@Composable
private fun MissingConfigScreen(appConfig: AppConfig) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EFE8))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = appConfig.validationError
                ?: "Android config is invalid. Check apps/android/local.properties.",
            color = Color(0xFF473C33),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.titleMedium
        )
    }
}

@Composable
private fun SignInScreen(
    state: AuthUiState,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onSignIn: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EFE8))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Sign in to ToDobile",
            color = Color(0xFF473C33),
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.size(16.dp))
        OutlinedTextField(
            value = state.email,
            onValueChange = onEmailChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            singleLine = true,
            enabled = !state.submitting
        )
        Spacer(modifier = Modifier.size(12.dp))
        OutlinedTextField(
            value = state.password,
            onValueChange = onPasswordChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            singleLine = true,
            enabled = !state.submitting,
            visualTransformation = PasswordVisualTransformation()
        )
        if (!state.errorMessage.isNullOrBlank()) {
            Spacer(modifier = Modifier.size(12.dp))
            Text(
                text = state.errorMessage,
                color = Color(0xFFC84D3A),
                textAlign = TextAlign.Center
            )
        }
        Spacer(modifier = Modifier.size(16.dp))
        Button(
            onClick = onSignIn,
            enabled = !state.submitting,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (state.submitting) "Signing in..." else "Sign in")
        }
    }
}

@Composable
private fun RecorderShell(
    userEmail: String?,
    onSignOut: () -> Unit,
    signOutInFlight: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EFE8))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = userEmail ?: "Signed in",
                modifier = Modifier.weight(1f),
                color = Color(0xFF473C33),
                style = MaterialTheme.typography.titleMedium
            )
            Button(onClick = onSignOut, enabled = !signOutInFlight) {
                Text(if (signOutInFlight) "Signing out..." else "Sign out")
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            ToDobileRecorderScreen()
        }
    }
}

@Composable
private fun ToDobileRecorderScreen() {
    val context = LocalContext.current
    val audioFile = remember { File(context.cacheDir, "todobile-recording.m4a") }
    val recorderController = remember { RecorderController(context, audioFile) }
    val workManager = remember(context) { WorkManager.getInstance(context) }
    val uploadWorkInfos by workManager
        .getWorkInfosForUniqueWorkLiveData(VoiceUploadWorker.UNIQUE_WORK_NAME)
        .observeAsState(emptyList())
    var uiState by remember { mutableStateOf(RecorderUiState.Ready) }
    var statusText by remember { mutableStateOf("Tap once to record") }
    var isPlaying by remember { mutableStateOf(false) }
    var isUploading by remember { mutableStateOf(false) }
    var uploadErrorText by remember { mutableStateOf<String?>(null) }
    var uploadSuccess by remember { mutableStateOf<UploadSuccessState?>(null) }

    LaunchedEffect(uploadWorkInfos) {
        val activeUpload = uploadWorkInfos.lastOrNull { !it.state.isFinished }
        if (activeUpload != null) {
            isUploading = true
            statusText = if (activeUpload.state == WorkInfo.State.RUNNING) {
                "Uploading recording..."
            } else {
                "Upload queued..."
            }
            return@LaunchedEffect
        }

        isUploading = false
        val latestCompleted = uploadWorkInfos.lastOrNull { it.state.isFinished } ?: return@LaunchedEffect
        when (latestCompleted.state) {
            WorkInfo.State.SUCCEEDED -> {
                val taskDetails = latestCompleted.outputData.getString(VoiceUploadWorker.KEY_TASK_DETAILS)
                val taskId = latestCompleted.outputData.getString(VoiceUploadWorker.KEY_TASK_ID)
                if (!taskDetails.isNullOrBlank() && !taskId.isNullOrBlank()) {
                    uploadSuccess = UploadSuccessState(taskId = taskId, taskDetails = taskDetails)
                    uploadErrorText = null
                    statusText = "Task created"
                }
            }

            WorkInfo.State.FAILED -> {
                uploadSuccess = null
                uploadErrorText = latestCompleted.outputData.getString(VoiceUploadWorker.KEY_ERROR_MESSAGE)
                    ?: "Upload failed"
                statusText = "Upload failed"
            }

            else -> Unit
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            statusText = "Tap once to record"
            uiState = if (audioFile.exists()) RecorderUiState.Recorded else RecorderUiState.Ready
        } else {
            statusText = "Microphone permission is required to record"
            uiState = RecorderUiState.PermissionDenied
        }
    }

    DisposableEffect(recorderController) {
        onDispose {
            recorderController.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        ToggleRecordButton(
            modifier = Modifier.align(Alignment.Center),
            isRecording = uiState == RecorderUiState.Recording,
            enabled = !isUploading,
            onToggleRecording = {
                val hasPermission = recorderController.hasRecordPermission()
                if (!hasPermission) {
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    statusText = "Waiting for microphone permission"
                    uiState = RecorderUiState.PermissionDenied
                } else if (isUploading) {
                    statusText = "Upload in progress..."
                } else if (uiState == RecorderUiState.Recording) {
                    when (recorderController.stopRecording()) {
                        RecordingStopResult.Saved -> {
                            isPlaying = false
                            statusText = "Upload queued..."
                            uiState = RecorderUiState.Recorded
                            uploadErrorText = null
                            uploadSuccess = null
                            isUploading = true
                            VoiceUploadWorker.enqueue(
                                context = context,
                                audioFile = audioFile,
                                mimeType = "audio/mp4"
                            )
                        }

                        RecordingStopResult.TooShort -> {
                            uploadErrorText = "Recording was too short. Please try again."
                            uploadSuccess = null
                            statusText = "Tap once to record"
                            uiState = RecorderUiState.Ready
                        }

                        RecordingStopResult.Failed -> {
                            uploadErrorText = "Unable to save recording. Please try again."
                            uploadSuccess = null
                            statusText = "Tap once to record"
                            uiState = RecorderUiState.Ready
                        }
                    }
                } else {
                    val started = recorderController.startRecording()
                    if (started) {
                        statusText = "Recording... tap again to stop"
                        uiState = RecorderUiState.Recording
                        uploadErrorText = null
                        uploadSuccess = null
                    } else {
                        statusText = "Unable to start recording"
                        uiState = if (audioFile.exists()) RecorderUiState.Recorded else RecorderUiState.Ready
                    }
                }
            }
        )

        Text(
            text = statusText,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 32.dp),
            color = Color(0xFF473C33),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.titleMedium
        )

        if (uiState == RecorderUiState.Recorded && audioFile.exists()) {
            IconButton(
                onClick = {
                    recorderController.playLatestRecording(
                        onPlaybackStart = {
                            isPlaying = true
                        },
                        onPlaybackComplete = {
                            isPlaying = false
                        }
                    )
                },
                enabled = !isUploading && uiState != RecorderUiState.Recording,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .size(72.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.PlayArrow,
                    contentDescription = "Play recording",
                    tint = if (isPlaying) Color(0xFFDA5A45) else Color(0xFF1F5A46),
                    modifier = Modifier.fillMaxSize()
                )
            }
        }

        if (!uploadErrorText.isNullOrBlank()) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = uploadErrorText.orEmpty(),
                    color = Color(0xFFC84D3A),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium
                )
                if (audioFile.exists() && uiState != RecorderUiState.Recording && !isUploading) {
                    Spacer(modifier = Modifier.size(8.dp))
                    Button(
                        onClick = {
                            uploadErrorText = null
                            uploadSuccess = null
                            statusText = "Retrying upload..."
                            isUploading = true
                            VoiceUploadWorker.enqueue(
                                context = context,
                                audioFile = audioFile,
                                mimeType = "audio/mp4"
                            )
                        }
                    ) {
                        Text("Retry upload")
                    }
                }
            }
        } else if (uploadSuccess != null) {
            Text(
                text = "Created task: ${uploadSuccess?.taskDetails}\n${uploadSuccess?.taskId}",
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 20.dp),
                color = Color(0xFF1F5A46),
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun ToggleRecordButton(
    modifier: Modifier = Modifier,
    isRecording: Boolean,
    enabled: Boolean,
    onToggleRecording: () -> Unit,
) {
    IconButton(
        onClick = onToggleRecording,
        enabled = enabled,
        modifier = modifier
            .size(220.dp)
            .background(
                color = if (isRecording) Color(0xFF1F8A55) else Color(0xFFDA5A45),
                shape = CircleShape
            )
    ) {
        Icon(
            imageVector = Icons.Filled.Mic,
            contentDescription = "Record audio",
            tint = Color.White,
            modifier = Modifier.size(96.dp)
        )
    }
}

private class RecorderController(
    private val context: Context,
    private val audioFile: File,
) {
    private var recorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var startedAtMs: Long? = null

    fun hasRecordPermission(): Boolean {
        return context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    fun startRecording(): Boolean {
        stopPlayback()
        recorder?.release()
        recorder = null

        return runCatching {
            if (audioFile.exists()) {
                audioFile.delete()
            }

            recorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128000)
                setAudioSamplingRate(44100)
                setOutputFile(audioFile.absolutePath)
                prepare()
                start()
            }
            startedAtMs = System.currentTimeMillis()
        }.isSuccess
    }

    fun stopRecording(): RecordingStopResult {
        val activeRecorder = recorder ?: return RecordingStopResult.Failed
        val durationMs = max(0L, System.currentTimeMillis() - (startedAtMs ?: System.currentTimeMillis()))
        val stopped = runCatching {
            activeRecorder.stop()
        }.isSuccess
        activeRecorder.release()
        recorder = null
        startedAtMs = null

        if (!stopped) {
            if (audioFile.exists()) {
                audioFile.delete()
            }
            return RecordingStopResult.Failed
        }

        if (durationMs < 750 || !audioFile.exists() || audioFile.length() == 0L) {
            if (audioFile.exists()) {
                audioFile.delete()
            }
            return RecordingStopResult.TooShort
        }

        return RecordingStopResult.Saved
    }

    fun playLatestRecording(
        onPlaybackStart: () -> Unit,
        onPlaybackComplete: () -> Unit,
    ) {
        if (!audioFile.exists()) {
            return
        }

        stopPlayback()
        mediaPlayer = MediaPlayer().apply {
            setDataSource(audioFile.absolutePath)
            setOnCompletionListener {
                stopPlayback()
                onPlaybackComplete()
            }
            prepare()
            start()
        }
        onPlaybackStart()
    }

    fun release() {
        runCatching { recorder?.stop() }
        recorder?.release()
        recorder = null
        startedAtMs = null
        stopPlayback()
    }

    private fun stopPlayback() {
        runCatching {
            mediaPlayer?.stop()
        }
        mediaPlayer?.release()
        mediaPlayer = null
    }
}

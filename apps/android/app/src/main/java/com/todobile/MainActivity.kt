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
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ToDobileRecorderScreen()
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

@Composable
private fun ToDobileRecorderScreen() {
    val context = LocalContext.current
    val audioFile = remember { File(context.cacheDir, "todobile-recording.m4a") }
    val recorderController = remember { RecorderController(context, audioFile) }
    var uiState by remember { mutableStateOf(RecorderUiState.Ready) }
    var statusText by remember { mutableStateOf("Press and hold to record") }
    var isPlaying by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            statusText = "Press and hold to record"
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
            .background(Color(0xFFF4EFE8))
            .padding(24.dp)
    ) {
        HoldToRecordButton(
            modifier = Modifier.align(Alignment.Center),
            isRecording = uiState == RecorderUiState.Recording,
            onPressStart = {
                val hasPermission = recorderController.hasRecordPermission()
                if (!hasPermission) {
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    statusText = "Waiting for microphone permission"
                    uiState = RecorderUiState.PermissionDenied
                    false
                } else {
                    val started = recorderController.startRecording()
                    if (started) {
                        statusText = "Recording... release to stop"
                        uiState = RecorderUiState.Recording
                    } else {
                        statusText = "Unable to start recording"
                        uiState = if (audioFile.exists()) RecorderUiState.Recorded else RecorderUiState.Ready
                    }
                    started
                }
            },
            onPressEnd = {
                if (uiState == RecorderUiState.Recording) {
                    recorderController.stopRecording()
                    isPlaying = false
                    statusText = "Recording saved"
                    uiState = RecorderUiState.Recorded
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
    }
}

@Composable
private fun HoldToRecordButton(
    modifier: Modifier = Modifier,
    isRecording: Boolean,
    onPressStart: () -> Boolean,
    onPressEnd: () -> Unit,
) {
    Box(
        modifier = modifier
            .size(220.dp)
            .background(
                color = if (isRecording) Color(0xFF1F8A55) else Color(0xFFDA5A45),
                shape = CircleShape
            )
            .pointerInput(isRecording) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    val started = onPressStart()
                    if (!started) {
                        return@awaitEachGesture
                    }
                    waitForUpOrCancellation(pass = PointerEventPass.Initial)
                    onPressEnd()
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.Mic,
            contentDescription = "Record audio",
            tint = Color.White,
            modifier = Modifier.size(96.dp)
        )
    }
}

private suspend fun androidx.compose.ui.input.pointer.AwaitPointerEventScope.waitForUpOrCancellation(
    pass: PointerEventPass,
) {
    while (true) {
        val event = awaitPointerEvent(pass)
        if (event.changes.all { !it.pressed }) {
            return
        }
        if (event.changes.any { it.isConsumed }) {
            return
        }
    }
}

private class RecorderController(
    private val context: Context,
    private val audioFile: File,
) {
    private var recorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null

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
        }.isSuccess
    }

    fun stopRecording() {
        val activeRecorder = recorder ?: return
        runCatching {
            activeRecorder.stop()
        }
        activeRecorder.release()
        recorder = null
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

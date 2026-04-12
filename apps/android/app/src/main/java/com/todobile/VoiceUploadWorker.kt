package com.todobile

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class VoiceUploadWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
) : CoroutineWorker(appContext, workerParameters) {
    override suspend fun doWork(): Result {
        val audioFilePath = inputData.getString(KEY_AUDIO_FILE_PATH)
            ?: return Result.failure(errorData("Missing audio file path"))
        val mimeType = inputData.getString(KEY_MIME_TYPE)
            ?: return Result.failure(errorData("Missing audio mime type"))

        val audioFile = File(audioFilePath)
        if (!audioFile.exists()) {
            return Result.failure(errorData("Recorded audio file no longer exists"))
        }

        val appConfig = AppConfig.fromBuildConfig()
        if (!appConfig.isComplete) {
            return Result.failure(errorData(appConfig.validationError ?: "Invalid app config"))
        }

        val accessToken = SupabaseClientProvider.get(appConfig)
            .auth
            .currentSessionOrNull()
            ?.accessToken
            ?: return Result.failure(errorData("No authenticated session available"))

        val uploader = VoiceCaptureUploader(appConfig)
        val uploadResult = uploader.uploadVoice(
            audioFile = audioFile,
            accessToken = accessToken,
            mimeType = mimeType
        )

        return uploadResult.fold(
            onSuccess = { success ->
                audioFile.delete()
                Result.success(
                    workDataOf(
                        KEY_TASK_ID to success.taskId,
                        KEY_TASK_DETAILS to success.taskDetails
                    )
                )
            },
            onFailure = { error ->
                when {
                    error.shouldRetry() -> Result.retry()
                    else -> Result.failure(errorData(error.message ?: "Upload failed"))
                }
            }
        )
    }

    companion object {
        const val UNIQUE_WORK_NAME = "todobile-voice-upload"
        const val KEY_AUDIO_FILE_PATH = "audio_file_path"
        const val KEY_MIME_TYPE = "mime_type"
        const val KEY_TASK_ID = "task_id"
        const val KEY_TASK_DETAILS = "task_details"
        const val KEY_ERROR_MESSAGE = "error_message"

        fun enqueue(
            context: Context,
            audioFile: File,
            mimeType: String,
        ) {
            val request = OneTimeWorkRequestBuilder<VoiceUploadWorker>()
                .setInputData(
                    workDataOf(
                        KEY_AUDIO_FILE_PATH to audioFile.absolutePath,
                        KEY_MIME_TYPE to mimeType
                    )
                )
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                request
            )
        }

        suspend fun getLatestWorkInfo(context: Context): WorkInfo? = withContext(Dispatchers.IO) {
            WorkManager.getInstance(context)
                .getWorkInfosForUniqueWork(UNIQUE_WORK_NAME)
                .get()
                .maxByOrNull { it.runAttemptCount }
        }
    }
}

private fun Throwable.shouldRetry(): Boolean {
    return when (this) {
        is IOException -> true
        is VoiceCaptureUploadException -> statusCode >= 500 || statusCode == 408 || statusCode == 429
        else -> false
    }
}

private fun errorData(message: String): Data {
    return workDataOf(VoiceUploadWorker.KEY_ERROR_MESSAGE to message)
}

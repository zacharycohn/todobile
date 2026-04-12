package com.todobile

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

class VoiceCaptureUploader(
    private val appConfig: AppConfig,
    private val client: OkHttpClient = OkHttpClient(),
) {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    suspend fun uploadVoice(
        audioFile: File,
        accessToken: String,
        mimeType: String,
    ): Result<VoiceCaptureUploadSuccess> = withContext(Dispatchers.IO) {
        runCatching {
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "audio",
                    audioFile.name,
                    audioFile.asRequestBody(mimeType.toMediaType())
                )
                .addFormDataPart("source", "android_app_voice")
                .addFormDataPart("mimeType", mimeType)
                .build()

            val request = Request.Builder()
                .url("${appConfig.apiBaseUrl}/api/v1/captures/voice")
                .header("Authorization", "Bearer $accessToken")
                .post(requestBody)
                .build()

            client.newCall(request).execute().use { response ->
                val rawBody = response.body?.string().orEmpty()
                val envelope = json.decodeFromString(
                    VoiceCaptureApiEnvelope.serializer(),
                    rawBody
                )

                if (!response.isSuccessful || envelope.error != null || envelope.data == null) {
                    throw VoiceCaptureUploadException(
                        statusCode = response.code,
                        envelope.error?.message.ifBlankOrNull {
                            "Voice capture upload failed"
                        }
                    )
                }

                VoiceCaptureUploadSuccess(
                    taskId = envelope.data.task.id,
                    taskDetails = envelope.data.task.details
                )
            }
        }
    }
}

class VoiceCaptureUploadException(
    val statusCode: Int,
    message: String,
) : IllegalStateException(message)

private fun String?.ifBlankOrNull(fallback: () -> String): String {
    val value = this?.trim()
    return if (value.isNullOrEmpty()) fallback() else value
}

data class VoiceCaptureUploadSuccess(
    val taskId: String,
    val taskDetails: String,
)

@Serializable
private data class VoiceCaptureApiEnvelope(
    val data: VoiceCaptureApiData? = null,
    val error: VoiceCaptureApiError? = null,
)

@Serializable
private data class VoiceCaptureApiData(
    val task: VoiceCaptureTask,
)

@Serializable
private data class VoiceCaptureTask(
    val id: String,
    val details: String,
)

@Serializable
private data class VoiceCaptureApiError(
    val code: String,
    val message: String,
    @SerialName("details")
    val extraDetails: Map<String, String>? = null,
)

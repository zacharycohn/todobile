package com.todobile

data class AppConfig(
    val supabaseUrl: String,
    val supabaseAnonKey: String,
    val apiBaseUrl: String,
    val isDebugBuild: Boolean,
) {
    val isComplete: Boolean
        get() = validationError == null

    val validationError: String?
        get() {
            if (supabaseUrl.isBlank()) {
                return "Missing Supabase URL."
            }
            if (supabaseAnonKey.isBlank()) {
                return "Missing Supabase anon key."
            }
            if (apiBaseUrl.isBlank()) {
                val keyName = if (isDebugBuild) {
                    "TODOBILE_API_BASE_URL_DEBUG"
                } else {
                    "TODOBILE_API_BASE_URL_RELEASE"
                }
                return "Missing API base URL. Add $keyName to apps/android/local.properties."
            }

            val normalizedApiBaseUrl = apiBaseUrl.lowercase()
            if (!isDebugBuild && !normalizedApiBaseUrl.startsWith("https://")) {
                return "Release builds require an HTTPS API base URL."
            }

            return null
        }

    companion object {
        fun fromBuildConfig() = AppConfig(
            supabaseUrl = BuildConfig.SUPABASE_URL.trim(),
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY.trim(),
            apiBaseUrl = BuildConfig.API_BASE_URL.trim().trimEnd('/'),
            isDebugBuild = BuildConfig.DEBUG
        )
    }
}

package com.todobile

import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.SupabaseClient

object SupabaseClientProvider {
    @Volatile
    private var client: SupabaseClient? = null

    fun get(appConfig: AppConfig): SupabaseClient {
        val existing = client
        if (existing != null) {
            return existing
        }

        return synchronized(this) {
            client ?: createSupabaseClient(
                supabaseUrl = appConfig.supabaseUrl,
                supabaseKey = appConfig.supabaseAnonKey
            ) {
                install(Auth)
            }.also {
                client = it
            }
        }
    }
}

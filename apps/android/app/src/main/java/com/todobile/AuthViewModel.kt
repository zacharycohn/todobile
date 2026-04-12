package com.todobile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val loading: Boolean = true,
    val submitting: Boolean = false,
    val errorMessage: String? = null,
    val accessToken: String? = null,
    val userEmail: String? = null,
) {
    val isSignedIn: Boolean
        get() = !accessToken.isNullOrBlank()
}

class AuthViewModel(
    appConfig: AppConfig,
) : ViewModel() {
    private val supabase = SupabaseClientProvider.get(appConfig)

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        observeSession()
        restoreSession()
    }

    fun onEmailChanged(value: String) {
        _uiState.update { it.copy(email = value, errorMessage = null) }
    }

    fun onPasswordChanged(value: String) {
        _uiState.update { it.copy(password = value, errorMessage = null) }
    }

    fun signIn() {
        val current = _uiState.value
        val trimmedEmail = current.email.trim()
        if (trimmedEmail.isBlank() || current.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Email and password are required") }
            return
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(trimmedEmail).matches()) {
            _uiState.update { it.copy(errorMessage = "Enter a valid email address") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(submitting = true, errorMessage = null) }
            runCatching {
                supabase.auth.signInWith(Email) {
                    email = trimmedEmail
                    password = current.password
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        submitting = false,
                        errorMessage = error.message ?: "Sign-in failed"
                    )
                }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _uiState.update { it.copy(submitting = true, errorMessage = null) }
            runCatching {
                supabase.auth.signOut()
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        submitting = false,
                        errorMessage = error.message ?: "Sign-out failed"
                    )
                }
            }
        }
    }

    private fun restoreSession() {
        viewModelScope.launch {
            val session = runCatching {
                supabase.auth.currentSessionOrNull()
            }.getOrNull()

            _uiState.update {
                it.copy(
                    loading = false,
                    accessToken = session?.accessToken,
                    userEmail = session?.user?.email
                )
            }
        }
    }

    private fun observeSession() {
        viewModelScope.launch {
            supabase.auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        _uiState.update {
                            it.copy(
                                loading = false,
                                submitting = false,
                                errorMessage = null,
                                password = "",
                                accessToken = status.session.accessToken,
                                userEmail = status.session.user?.email
                            )
                        }
                    }

                    SessionStatus.Initializing -> {
                        _uiState.update { it.copy(loading = true) }
                    }

                    is SessionStatus.NotAuthenticated -> {
                        _uiState.update {
                            it.copy(
                                loading = false,
                                submitting = false,
                                accessToken = null,
                                userEmail = null,
                                password = ""
                            )
                        }
                    }

                    is SessionStatus.RefreshFailure -> {
                        _uiState.update {
                            it.copy(
                                loading = false,
                                submitting = false,
                                accessToken = null,
                                userEmail = null,
                                password = "",
                                errorMessage = "Your session expired. Please sign in again."
                            )
                        }
                    }
                }
            }
        }
    }
}

class AuthViewModelFactory(
    private val appConfig: AppConfig,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AuthViewModel(appConfig) as T
        }
        throw IllegalArgumentException("Unsupported ViewModel class: ${modelClass.name}")
    }
}

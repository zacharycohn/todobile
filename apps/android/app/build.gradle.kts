import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("org.jetbrains.kotlin.plugin.compose")
  id("org.jetbrains.kotlin.plugin.serialization") version "2.1.20"
}

val localProperties = Properties().apply {
  val localPropertiesFile = rootProject.file("local.properties")
  if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use(::load)
  }
}

fun configValue(name: String): String {
  val value = (localProperties.getProperty(name) ?: providers.environmentVariable(name).orNull)?.trim()
  return value?.takeIf { it.isNotEmpty() } ?: ""
}

val debugApiBaseUrl = configValue("TODOBILE_API_BASE_URL_DEBUG").ifEmpty {
  configValue("TODOBILE_API_BASE_URL")
}
val releaseApiBaseUrl = configValue("TODOBILE_API_BASE_URL_RELEASE")

configurations.all {
  resolutionStrategy.force("androidx.browser:browser:1.8.0")
}

android {
  namespace = "com.todobile"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.todobile"
    minSdk = 28
    targetSdk = 35
    versionCode = 1
    versionName = "1.0.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    vectorDrawables {
      useSupportLibrary = true
    }

    buildConfigField("String", "SUPABASE_URL", "\"${configValue("TODOBILE_SUPABASE_URL")}\"")
    buildConfigField("String", "SUPABASE_ANON_KEY", "\"${configValue("TODOBILE_SUPABASE_ANON_KEY")}\"")
  }

  buildTypes {
    debug {
      buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
    }

    release {
      buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.16.0")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
  implementation("androidx.activity:activity-compose:1.10.1")
  implementation(platform("androidx.compose:compose-bom:2025.03.00"))
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-graphics")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.runtime:runtime-livedata")
  implementation("androidx.compose.material3:material3")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.browser:browser:1.8.0")
  implementation("androidx.compose.material:material-icons-extended")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
  implementation(platform("io.github.jan-tennert.supabase:bom:3.2.4"))
  implementation("io.github.jan-tennert.supabase:auth-kt")
  implementation("io.ktor:ktor-client-okhttp:3.3.0")
  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
  implementation("androidx.work:work-runtime-ktx:2.10.0")
  implementation("com.google.firebase:firebase-messaging-ktx:24.1.0")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation(platform("androidx.compose:compose-bom:2025.03.00"))
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
  androidTestImplementation("androidx.compose.ui:ui-test-junit4")
  debugImplementation("androidx.compose.ui:ui-tooling")
  debugImplementation("androidx.compose.ui:ui-test-manifest")
}

package com.nuvio.tv.data.remote.interceptors

import com.nuvio.tv.BuildConfig
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Interceptor that adds TMDB API key to all requests.
 */
@Singleton
class TMDBInterceptor @Inject constructor() : Interceptor {

    companion object {
        const val API_KEY = "d131017ccc6e5462a81c9304d21476de"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val originalUrl = originalRequest.url

        val newUrl = originalUrl.newBuilder()
            .addQueryParameter("api_key", API_KEY)
            .build()

        val newRequest = originalRequest.newBuilder()
            .url(newUrl)
            .build()

        return chain.proceed(newRequest)
    }
}

/**
 * Interceptor that adds Trakt API headers to all requests.
 */
@Singleton
class TraktInterceptor @Inject constructor() : Interceptor {

    companion object {
        const val CLIENT_ID = "c0f14dabd2eb5d9ec3f1f4bb20b9f3f6c03a4df7f93e7bb32e9c0f8b5c1e4b1a"
        const val API_VERSION = "2"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        val newRequest = originalRequest.newBuilder()
            .addHeader("Content-Type", "application/json")
            .addHeader("trakt-api-version", API_VERSION)
            .addHeader("trakt-api-key", CLIENT_ID)
            .build()

        return chain.proceed(newRequest)
    }
}

/**
 * Interceptor for logging requests (debug builds only).
 */
@Singleton
class LoggingInterceptor @Inject constructor() : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        if (BuildConfig.DEBUG) {
            android.util.Log.d("NuvioTV", "Request: ${request.method} ${request.url}")
        }

        val response = chain.proceed(request)

        if (BuildConfig.DEBUG) {
            android.util.Log.d("NuvioTV", "Response: ${response.code} ${request.url}")
        }

        return response
    }
}

/**
 * Interceptor that handles common error responses.
 */
@Singleton
class ErrorInterceptor @Inject constructor() : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)

        when (response.code) {
            401 -> {
                // Unauthorized - token might be expired
                android.util.Log.w("NuvioTV", "Unauthorized request: ${request.url}")
            }
            403 -> {
                // Forbidden
                android.util.Log.w("NuvioTV", "Forbidden request: ${request.url}")
            }
            429 -> {
                // Rate limited
                android.util.Log.w("NuvioTV", "Rate limited: ${request.url}")
            }
            in 500..599 -> {
                // Server error
                android.util.Log.e("NuvioTV", "Server error ${response.code}: ${request.url}")
            }
        }

        return response
    }
}

/**
 * Interceptor that adds User-Agent header.
 */
@Singleton
class UserAgentInterceptor @Inject constructor() : Interceptor {

    companion object {
        const val USER_AGENT = "NuvioTV/1.0.0 (Android TV)"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header("User-Agent", USER_AGENT)
            .build()

        return chain.proceed(request)
    }
}

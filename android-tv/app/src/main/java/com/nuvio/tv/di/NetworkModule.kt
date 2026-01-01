package com.nuvio.tv.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.nuvio.tv.data.remote.api.StremioApi
import com.nuvio.tv.data.remote.api.TMDBApi
import com.nuvio.tv.data.remote.api.TraktApi
import com.nuvio.tv.data.remote.interceptors.ErrorInterceptor
import com.nuvio.tv.data.remote.interceptors.LoggingInterceptor
import com.nuvio.tv.data.remote.interceptors.TMDBInterceptor
import com.nuvio.tv.data.remote.interceptors.TraktInterceptor
import com.nuvio.tv.data.remote.interceptors.UserAgentInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    // ==================== OkHttp Clients ====================

    @Provides
    @Singleton
    @Named("base")
    fun provideBaseOkHttpClient(
        userAgentInterceptor: UserAgentInterceptor,
        loggingInterceptor: LoggingInterceptor,
        errorInterceptor: ErrorInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(userAgentInterceptor)
            .addInterceptor(loggingInterceptor)
            .addInterceptor(errorInterceptor)
            .build()
    }

    @Provides
    @Singleton
    @Named("tmdb")
    fun provideTMDBOkHttpClient(
        @Named("base") baseClient: OkHttpClient,
        tmdbInterceptor: TMDBInterceptor
    ): OkHttpClient {
        return baseClient.newBuilder()
            .addInterceptor(tmdbInterceptor)
            .build()
    }

    @Provides
    @Singleton
    @Named("trakt")
    fun provideTraktOkHttpClient(
        @Named("base") baseClient: OkHttpClient,
        traktInterceptor: TraktInterceptor
    ): OkHttpClient {
        return baseClient.newBuilder()
            .addInterceptor(traktInterceptor)
            .build()
    }

    @Provides
    @Singleton
    @Named("stremio")
    fun provideStremioOkHttpClient(
        @Named("base") baseClient: OkHttpClient
    ): OkHttpClient {
        // Stremio client with longer timeout for addon requests
        return baseClient.newBuilder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    // ==================== Retrofit Instances ====================

    @Provides
    @Singleton
    @Named("tmdb")
    fun provideTMDBRetrofit(
        @Named("tmdb") okHttpClient: OkHttpClient
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(TMDBApi.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    @Named("trakt")
    fun provideTraktRetrofit(
        @Named("trakt") okHttpClient: OkHttpClient
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(TraktApi.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    @Named("stremio")
    fun provideStremioRetrofit(
        @Named("stremio") okHttpClient: OkHttpClient
    ): Retrofit {
        // Base URL doesn't matter for Stremio since we use @Url
        return Retrofit.Builder()
            .baseUrl("https://stremio.example.com/")
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    // ==================== API Services ====================

    @Provides
    @Singleton
    fun provideTMDBApi(
        @Named("tmdb") retrofit: Retrofit
    ): TMDBApi {
        return retrofit.create(TMDBApi::class.java)
    }

    @Provides
    @Singleton
    fun provideTraktApi(
        @Named("trakt") retrofit: Retrofit
    ): TraktApi {
        return retrofit.create(TraktApi::class.java)
    }

    @Provides
    @Singleton
    fun provideStremioApi(
        @Named("stremio") retrofit: Retrofit
    ): StremioApi {
        return retrofit.create(StremioApi::class.java)
    }
}

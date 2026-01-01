package com.nuvio.tv

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.util.DebugLogger
import com.tencent.mmkv.MMKV
import dagger.hilt.android.HiltAndroidApp
import java.io.File

@HiltAndroidApp
class NuvioTvApplication : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        initializeMMKV()
    }

    private fun initializeMMKV() {
        // Try to use shared storage path with mobile app if available
        val sharedMmkvPath = getSharedMmkvPath()
        if (sharedMmkvPath != null && File(sharedMmkvPath).exists()) {
            MMKV.initialize(this, sharedMmkvPath)
        } else {
            // Fall back to default MMKV path
            MMKV.initialize(this)
        }
    }

    private fun getSharedMmkvPath(): String? {
        // Try to find the mobile app's MMKV storage
        // The mobile app uses: /data/data/com.nuvio.stream/files/mmkv
        val possiblePaths = listOf(
            "/data/data/com.nuvio.stream/files/mmkv",
            "${filesDir.parentFile?.parentFile}/com.nuvio.stream/files/mmkv"
        )
        return possiblePaths.firstOrNull { File(it).exists() }
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25) // Use 25% of app memory for image cache
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.05) // Use 5% of free disk space
                    .build()
            }
            .crossfade(true)
            .respectCacheHeaders(false) // Better for streaming app posters
            .apply {
                if (BuildConfig.DEBUG) {
                    logger(DebugLogger())
                }
            }
            .build()
    }
}

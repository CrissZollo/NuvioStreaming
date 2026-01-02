package com.nuvio.tv.di

import com.nuvio.tv.player.engine.ExoPlayerEngine
import com.nuvio.tv.player.engine.MpvEngine
import com.nuvio.tv.player.engine.UnifiedPlayer
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module for providing video player instances.
 */
@Module
@InstallIn(SingletonComponent::class)
object PlayerModule {

    @Provides
    @Singleton
    fun provideMpvEngine(): MpvEngine {
        return MpvEngine()
    }

    @Provides
    @Singleton
    fun provideExoPlayerEngine(): ExoPlayerEngine {
        return ExoPlayerEngine()
    }

    @Provides
    @Singleton
    fun provideUnifiedPlayer(
        mpvEngine: MpvEngine,
        exoPlayerEngine: ExoPlayerEngine
    ): UnifiedPlayer {
        return UnifiedPlayer(mpvEngine, exoPlayerEngine)
    }
}

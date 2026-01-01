package com.nuvio.tv.di

import com.nuvio.tv.data.remote.api.StremioApi
import com.nuvio.tv.data.remote.api.TMDBApi
import com.nuvio.tv.data.remote.api.TraktApi
import com.nuvio.tv.data.repository.AddonRepository
import com.nuvio.tv.data.repository.CatalogRepository
import com.nuvio.tv.data.repository.ContentRepository
import com.nuvio.tv.data.repository.LibraryRepository
import com.nuvio.tv.data.repository.SettingsRepository
import com.nuvio.tv.data.repository.TraktRepository
import com.nuvio.tv.data.repository.WatchProgressRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module for providing repository instances.
 */
@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideAddonRepository(
        stremioApi: StremioApi,
        mmkvDataSource: com.nuvio.tv.data.local.MMKVDataSource
    ): AddonRepository {
        return AddonRepository(stremioApi, mmkvDataSource)
    }

    @Provides
    @Singleton
    fun provideCatalogRepository(
        stremioApi: StremioApi,
        addonRepository: AddonRepository
    ): CatalogRepository {
        return CatalogRepository(stremioApi, addonRepository)
    }

    @Provides
    @Singleton
    fun provideContentRepository(
        stremioApi: StremioApi,
        tmdbApi: TMDBApi,
        addonRepository: AddonRepository
    ): ContentRepository {
        return ContentRepository(stremioApi, tmdbApi, addonRepository)
    }

    @Provides
    @Singleton
    fun provideLibraryRepository(): LibraryRepository {
        return LibraryRepository()
    }

    @Provides
    @Singleton
    fun provideSettingsRepository(): SettingsRepository {
        return SettingsRepository()
    }

    @Provides
    @Singleton
    fun provideTraktRepository(
        traktApi: TraktApi
    ): TraktRepository {
        return TraktRepository(traktApi)
    }

    @Provides
    @Singleton
    fun provideWatchProgressRepository(): WatchProgressRepository {
        return WatchProgressRepository()
    }
}

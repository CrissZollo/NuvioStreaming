package com.nuvio.tv.data.api

import com.nuvio.tv.domain.model.TorBoxPlan
import com.nuvio.tv.domain.model.TorBoxUser
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

/**
 * TorBox API interface.
 * Base URL: https://api.torbox.app/v1
 */
interface TorBoxApi {

    /**
     * Get user profile information.
     * Used to validate API key and fetch account details.
     */
    @GET("api/user/me")
    suspend fun getUserInfo(
        @Header("Authorization") authorization: String,
        @Query("settings") settings: Boolean = false
    ): TorBoxUserResponse

    companion object {
        const val BASE_URL = "https://api.torbox.app/v1/"

        /**
         * Generate TorBox addon manifest URL.
         */
        fun getManifestUrl(apiKey: String): String =
            "https://stremio.torbox.app/$apiKey/manifest.json"

        /**
         * Generate authorization header from API key.
         */
        fun getAuthHeader(apiKey: String): String = "Bearer $apiKey"
    }
}

/**
 * TorBox API response for user info.
 */
@Serializable
data class TorBoxUserResponse(
    val success: Boolean,
    val data: TorBoxUserData? = null,
    val detail: String? = null,
    val error: String? = null
)

/**
 * TorBox user data from API.
 */
@Serializable
data class TorBoxUserData(
    val id: Int,
    val email: String,
    val plan: Int,
    @SerialName("total_downloaded")
    val totalDownloaded: Long,
    @SerialName("is_subscribed")
    val isSubscribed: Boolean,
    @SerialName("premium_expires_at")
    val premiumExpiresAt: String? = null,
    @SerialName("base_email")
    val baseEmail: String
) {
    /**
     * Convert to domain model.
     */
    fun toTorBoxUser(): TorBoxUser = TorBoxUser(
        id = id,
        email = email,
        plan = TorBoxPlan.fromPlanId(plan),
        totalDownloaded = totalDownloaded,
        isSubscribed = isSubscribed,
        premiumExpiresAt = premiumExpiresAt,
        baseEmail = baseEmail
    )
}

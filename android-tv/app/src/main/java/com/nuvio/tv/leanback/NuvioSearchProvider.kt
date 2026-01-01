package com.nuvio.tv.leanback

import android.app.SearchManager
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

/**
 * Content provider for Android TV global search integration.
 * Allows users to find Nuvio content from the Android TV home screen search.
 */
class NuvioSearchProvider : ContentProvider() {

    companion object {
        private val SEARCH_COLUMNS = arrayOf(
            SearchManager.SUGGEST_COLUMN_INTENT_DATA_ID,
            SearchManager.SUGGEST_COLUMN_TEXT_1,
            SearchManager.SUGGEST_COLUMN_TEXT_2,
            SearchManager.SUGGEST_COLUMN_RESULT_CARD_IMAGE,
            SearchManager.SUGGEST_COLUMN_CONTENT_TYPE,
            SearchManager.SUGGEST_COLUMN_PRODUCTION_YEAR,
            SearchManager.SUGGEST_COLUMN_DURATION
        )
    }

    override fun onCreate(): Boolean {
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor {
        val query = selectionArgs?.firstOrNull() ?: ""

        if (query.length < 2) {
            return MatrixCursor(SEARCH_COLUMNS)
        }

        // TODO: Implement search via repository
        // For now, return empty results
        return MatrixCursor(SEARCH_COLUMNS)
    }

    override fun getType(uri: Uri): String? {
        return "vnd.android.cursor.dir/vnd.nuvio.tv.search"
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = 0
}

package com.hekayat.stories.data

import com.google.gson.annotations.SerializedName

data class Story(
    val id: String,
    val title: String,
    val description: String?,
    @SerializedName("video_url") val videoUrl: String,
    @SerializedName("cover_url") val coverUrl: String?,
    @SerializedName("category_id") val categoryId: String?
)

data class ViewRequest(@SerializedName("story_id") val storyId: String)

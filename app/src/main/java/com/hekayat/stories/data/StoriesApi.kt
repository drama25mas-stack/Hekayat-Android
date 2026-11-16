package com.hekayat.stories.data

import com.hekayat.stories.BuildConfig
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface StoriesApi {
    @GET("v1/stories")
    suspend fun getPublishedStories(): List<Story>

    @POST("v1/views")
    suspend fun recordView(@Body request: ViewRequest)

    companion object {
        val service: StoriesApi by lazy {
            Retrofit.Builder()
                .baseUrl(BuildConfig.STORIES_API_BASE_URL.let {
                    if (it.endsWith("/")) it else "$it/"
                })
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(StoriesApi::class.java)
        }
    }
}

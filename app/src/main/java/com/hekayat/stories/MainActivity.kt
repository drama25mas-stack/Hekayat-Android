package com.hekayat.stories

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmarks
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hekayat.stories.data.StoriesApi
import com.hekayat.stories.data.Story
import com.hekayat.stories.data.ViewRequest
import com.hekayat.stories.player.StoryPlayerDialog
import kotlinx.coroutines.launch

private val Ink = Color(0xFF090B12)
private val Panel = Color(0xFF151A27)
private val Gold = Color(0xFFE8B86D)
private val Muted = Color(0xFF9AA3B5)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { HekayatApp() }
    }
}

@Composable
private fun HekayatApp() {
    var selected by remember { mutableIntStateOf(0) }
    var stories by remember { mutableStateOf<List<Story>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var playingStory by remember { mutableStateOf<Story?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun refreshStories() {
        loading = true
        loadError = null
        try {
            stories = StoriesApi.service.getPublishedStories()
        } catch (_: Exception) {
            loadError = "تعذر تحميل القصص. تأكد من إعداد رابط الخادم واتصال الإنترنت."
        } finally {
            loading = false
        }
    }
    LaunchedEffect(Unit) { refreshStories() }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
            Scaffold(
                containerColor = Ink,
                bottomBar = {
                    NavigationBar(containerColor = Panel, contentColor = Gold) {
                        NavigationBarItem(selected == 0, { selected = 0 }, icon = { Icon(Icons.Default.Explore, null) }, label = { Text("اكتشف") })
                        NavigationBarItem(selected == 1, { selected = 1 }, icon = { Icon(Icons.Default.Search, null) }, label = { Text("بحث") })
                        NavigationBarItem(selected == 2, { selected = 2 }, icon = { Icon(Icons.Default.Bookmarks, null) }, label = { Text("المحفوظات") })
                    }
                }
            ) { padding ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column {
                                Text("حكايات", color = Gold, fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
                                Text("كل حكاية… عالم جديد", color = Muted, fontSize = 13.sp)
                            }
                            Text("✦", color = Gold, fontSize = 28.sp)
                        }
                    }
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("حكايات تستحق المشاهدة", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                Text("شاهد أحدث القصص المنشورة مباشرة.", color = Muted, fontSize = 13.sp)
                            }
                        }
                    }
                    item { Text(if (selected == 2) "المحفوظات" else if (selected == 1) "اكتشف القصص" else "أحدث الحكايات", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
                    if (loading) {
                        item { Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Gold) } }
                    } else if (loadError != null) {
                        item {
                            Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text(loadError!!, color = Muted)
                                    Text("إعادة المحاولة", color = Gold, modifier = Modifier.clickable { scope.launch { refreshStories() } })
                                }
                            }
                        }
                    } else if (stories.isEmpty()) {
                        item { Text("لا توجد قصص منشورة حتى الآن.", color = Muted) }
                    } else {
                        items(stories, key = { it.id }) { story ->
                            StoryCard(story = story, onClick = {
                                playingStory = story
                                scope.launch { runCatching { StoriesApi.service.recordView(ViewRequest(story.id)) } }
                            })
                        }
                    }
                    item {
                        Spacer(Modifier.height(12.dp))
                        Text("HEKAYAT  •  STORIES", color = Color(0xFF657087), fontSize = 10.sp, letterSpacing = 2.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                    }
                }
            }
            playingStory?.let { StoryPlayerDialog(it) { playingStory = null } }
        }
    }
}

@Composable
private fun StoryCard(story: Story, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(story.title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            if (!story.description.isNullOrBlank()) Text(story.description, color = Muted, fontSize = 13.sp, maxLines = 3)
            Text("▶  مشاهدة القصة", color = Gold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
    }
}

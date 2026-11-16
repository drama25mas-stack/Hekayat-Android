package com.hekayat.stories

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
    MaterialTheme {
        Surface(Modifier.fillMaxSize(), color = Ink) {
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
                    verticalArrangement = Arrangement.spacedBy(18.dp)
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
                            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("اكتشف قصتك القادمة", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                                Text("مجموعة من الحكايات المصورة في مكان واحد.", color = Muted, fontSize = 14.sp)
                                Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFF293044)))
                                Text("سيتم عرض القصص المنشورة هنا بمجرد ربط خدمة المحتوى.", color = Muted, fontSize = 13.sp)
                            }
                        }
                    }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(if (selected == 2) "المحفوظات" else if (selected == 1) "ابحث عن حكاية" else "أحدث الحكايات", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Text("لا توجد قصص منشورة حتى الآن.", color = Muted, fontSize = 14.sp)
                        }
                    }
                    item {
                        Spacer(Modifier.height(16.dp))
                        Text("HEKAYAT  •  STORIES", color = Color(0xFF657087), fontSize = 10.sp, letterSpacing = 2.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}

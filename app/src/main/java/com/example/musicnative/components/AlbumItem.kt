package com.example.musicnative.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import com.example.musicnative.Album
import com.example.musicnative.Artist
import com.example.musicnative.combineNames

@Composable
fun AlbumItem(album: Album, artists: Map<String, Artist>) {
    val artists = combineNames(album.artistIds.mapNotNull { artistId -> artists[artistId] })
    Row {
        if (album.artFile != null) {
            println("artfile is not null")
            ImageBox(filePath = album.artFile)
        } else {
            println("art-file is null")
        }
        Column {
            Text(album.name, textAlign = TextAlign.Left, fontSize = 22.sp)
            Text(artists, textAlign = TextAlign.Left, fontSize = 12.sp)
        }
    }
}
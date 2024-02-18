package com.example.musicnative.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Environment
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.rememberImagePainter
import com.example.musicnative.R
import java.io.File

@Composable
fun ImageBox(filePath: String?) {
    var imgBitmap: Bitmap? = null
    val context = LocalContext.current
    val fileDir = context.getExternalFilesDir(null)?.absolutePath
    val artPath = "$fileDir/$filePath"
    val imgFile = File(artPath)
    if (imgFile.exists()) {
        println("has img")
        imgBitmap = BitmapFactory.decodeFile(imgFile.absolutePath)
    } else {
        println("nope :(")
        println(artPath)
    }
    Box(
        Modifier
            .height(44.dp)
            .width(44.dp)
            .padding(top = 8.dp, end = 8.dp)
    ){
        Image(painter = rememberImagePainter(data = imgBitmap, builder = {
            placeholder(R.drawable.ic_baseline_album_24)
        }), contentDescription = "Album Art",)
    }
}
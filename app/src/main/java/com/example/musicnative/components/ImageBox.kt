package com.example.musicnative.components

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.musicnative.R
import java.io.File

/** Local art thumbnail with a vinyl-tile fallback. Circular when round=true (artists). */
@Composable
fun ImageBox(
    filePath: String?,
    size: Dp = 44.dp,
    round: Boolean = false,
    placeholder: Int = R.drawable.missing_album,
) {
    val context = LocalContext.current
    val fileDir = context.getExternalFilesDir(null)?.absolutePath
    val imgBitmap = remember(filePath) {
        val imgFile = File("$fileDir/$filePath")
        if (filePath != null && imgFile.exists()) {
            BitmapFactory.decodeFile(imgFile.absolutePath)
        } else {
            null
        }
    }
    val shape = if (round) CircleShape else RoundedCornerShape(6.dp)
    val modifier = Modifier
        .size(size)
        .clip(shape)
    if (imgBitmap != null) {
        Image(
            bitmap = imgBitmap.asImageBitmap(),
            contentDescription = "Art",
            contentScale = ContentScale.Crop,
            modifier = modifier,
        )
    } else {
        Image(
            painter = painterResource(placeholder),
            contentDescription = "Art",
            contentScale = ContentScale.Crop,
            modifier = modifier,
        )
    }
}

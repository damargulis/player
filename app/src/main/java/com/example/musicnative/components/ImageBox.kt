package com.example.musicnative.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.musicnative.R
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// decoded-thumbnail cache so scrolled-back rows render instantly (~32MB cap)
private val bitmapCache = object : LruCache<String, Bitmap>(32 * 1024 * 1024) {
    override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
}

/** Decodes a file downsampled to roughly targetPx on its shorter side. */
private fun decodeSampled(path: String, targetPx: Int): Bitmap? {
    if (!File(path).exists()) {
        return null
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
        return null
    }
    var sampleSize = 1
    while (bounds.outWidth / (sampleSize * 2) >= targetPx &&
        bounds.outHeight / (sampleSize * 2) >= targetPx) {
        sampleSize *= 2
    }
    return BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sampleSize })
}

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
    val sizePx = with(LocalDensity.current) { size.roundToPx() }
    // cache per size bucket so the big player art isn't served a list thumbnail
    val cacheKey = "$filePath@$sizePx"
    // remember(cacheKey) resets the shown bitmap the moment the target image
    // changes; without that, a stale bitmap survives track changes
    var imgBitmap by remember(cacheKey) { mutableStateOf(bitmapCache.get(cacheKey)) }
    LaunchedEffect(cacheKey) {
        if (imgBitmap == null && filePath != null) {
            imgBitmap = withContext(Dispatchers.IO) {
                decodeSampled("$fileDir/$filePath", sizePx)
            }?.also { bitmapCache.put(cacheKey, it) }
        }
    }
    val shape = if (round) CircleShape else RoundedCornerShape(6.dp)
    val modifier = Modifier
        .size(size)
        .clip(shape)
    val bitmap = imgBitmap
    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
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

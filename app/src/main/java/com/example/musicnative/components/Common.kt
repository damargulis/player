package com.example.musicnative.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Button
import androidx.compose.material.ButtonDefaults
import androidx.compose.material.OutlinedButton
import androidx.compose.material.Text
import androidx.compose.material.TextField
import androidx.compose.material.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.ui.theme.Accent
import com.example.musicnative.ui.theme.Surface
import com.example.musicnative.ui.theme.TextPrimary
import com.example.musicnative.ui.theme.TextSecondary

@Composable
fun SearchField(query: String, placeholder: String, onQueryChange: (String) -> Unit) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        placeholder = { Text(placeholder, color = TextSecondary, fontSize = 15.sp) },
        singleLine = true,
        shape = RoundedCornerShape(10.dp),
        colors = TextFieldDefaults.textFieldColors(
            backgroundColor = Surface,
            textColor = TextPrimary,
            cursorColor = Accent,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
    )
}

@Composable
fun PillButton(text: String, filled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    if (filled) {
        Button(
            onClick = onClick,
            modifier = modifier,
            shape = RoundedCornerShape(24.dp),
            elevation = ButtonDefaults.elevation(defaultElevation = 0.dp),
            colors = ButtonDefaults.buttonColors(
                backgroundColor = Accent,
                contentColor = Color.White,
            )
        ) {
            Text(text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier,
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(1.dp, Accent),
            colors = ButtonDefaults.outlinedButtonColors(
                backgroundColor = Color.Transparent,
                contentColor = Accent,
            )
        ) {
            Text(text, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        }
    }
}

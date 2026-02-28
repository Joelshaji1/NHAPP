package com.nhapp.ui.profile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nhapp.data.model.Profile
import com.nhapp.data.repository.ProfileRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream

sealed class ProfileState {
    object Loading : ProfileState()
    data class Success(val profile: Profile) : ProfileState()
    data class Error(val message: String) : ProfileState()
}

class ProfileViewModel(
    private val userId: String,
    private val repository: ProfileRepository = ProfileRepository()
) : ViewModel() {

    private val _state = MutableStateFlow<ProfileState>(ProfileState.Loading)
    val state = _state.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving = _isSaving.asStateFlow()

    init {
        loadProfile()
    }

    private fun loadProfile() {
        viewModelScope.launch {
            try {
                _state.value = ProfileState.Loading
                val profile = repository.getProfile(userId)
                if (profile != null) {
                    _state.value = ProfileState.Success(profile)
                } else {
                    _state.value = ProfileState.Error("Profile not found")
                }
            } catch (e: Exception) {
                _state.value = ProfileState.Error(e.message ?: "Failed to load profile")
            }
        }
    }

    fun saveProfile(newName: String, newImageBytes: ByteArray?) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                var avatarUrl: String? = null
                
                // Compress and Upload if an image was selected
                if (newImageBytes != null) {
                    val compressedBytes = compressImage(newImageBytes)
                    avatarUrl = repository.uploadAvatar(userId, compressedBytes)
                }

                // Update database
                repository.updateProfile(userId, newName, avatarUrl)
                
                // Reload
                loadProfile()
            } catch (e: Exception) {
                // If it fails, restore previous state but show error in logs
                e.printStackTrace()
            } finally {
                _isSaving.value = false
            }
        }
    }

    private fun compressImage(originalBytes: ByteArray): ByteArray {
        val bitmap = BitmapFactory.decodeByteArray(originalBytes, 0, originalBytes.size)
        
        // Scale down if massive (avatars should be small)
        val maxDim = 800
        val scale = minOf(maxDim.toFloat() / bitmap.width, maxDim.toFloat() / bitmap.height)
        
        val finalBitmap = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).toInt(),
                (bitmap.height * scale).toInt(),
                true
            )
        } else {
            bitmap
        }

        val outputStream = ByteArrayOutputStream()
        // Aggressive compression for avatars
        finalBitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream)
        return outputStream.toByteArray()
    }
}

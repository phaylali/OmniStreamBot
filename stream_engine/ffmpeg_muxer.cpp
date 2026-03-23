#include "ffmpeg_muxer.h"
#include <iostream>
#include <vector>

FFmpegMuxer::FFmpegMuxer(const std::string& twitch_key, const std::string& kick_key)
    : twitch_key_(twitch_key), kick_key_(kick_key), ffmpeg_pipe_(nullptr), running_(false) {
}

FFmpegMuxer::~FFmpegMuxer() {
    stop();
}

bool FFmpegMuxer::start() {
    if (running_) return false;

    std::string cmd = "ffmpeg -hide_banner -re -fflags +genpts+nobuffer -err_detect ignore_err -f mjpeg -i pipe:0 ";
    
    // Use libx264 with ultrafast preset for lowest CPU
    cmd += "-c:v libx264 -preset ultrafast -tune zerolatency "
           "-b:v 3000k -maxrate 3000k -bufsize 6000k "
           "-pix_fmt yuv420p -g 60 -keyint_min 60 "
           "-c:a aac -b:a 128k -ar 44100 ";

    bool has_twitch = !twitch_key_.empty();
    bool has_kick = !kick_key_.empty();

    if (!has_twitch && !has_kick) {
        std::cerr << "[FFmpegMuxer] No stream keys provided!\n";
        return false;
    }

    if (has_twitch && has_kick) {
        cmd += "-f tee -map 0:v -map 0:a \"[f=flv]rtmp://live.twitch.tv/app/" + twitch_key_ + 
               "|[f=flv]rtmps://fa723fc1b171.global-contribute.live-video.net:443/app/" + kick_key_ + "\"";
    } else if (has_twitch) {
        cmd += "-f flv rtmp://live.twitch.tv/app/" + twitch_key_;
    } else if (has_kick) {
        cmd += "-f flv rtmps://fa723fc1b171.global-contribute.live-video.net:443/app/" + kick_key_;
    }

    std::cout << "[FFmpegMuxer] Starting FFmpeg: " << cmd << "\n";
    ffmpeg_pipe_ = popen(cmd.c_str(), "w");
    if (!ffmpeg_pipe_) {
        std::cerr << "[FFmpegMuxer] Failed to open pipe to FFmpeg\n";
        return false;
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    running_ = true;
    return true;
}

void FFmpegMuxer::stop() {
    if (!running_) return;
    
    running_ = false;
    if (ffmpeg_pipe_) {
        std::cout << "[FFmpegMuxer] Closing FFmpeg pipe...\n";
        pclose(ffmpeg_pipe_);
        ffmpeg_pipe_ = nullptr;
    }
}

bool FFmpegMuxer::write_chunk(const char* data, size_t size) {
    if (!running_ || !ffmpeg_pipe_) return false;
    
    size_t written = fwrite(data, 1, size, ffmpeg_pipe_);
    if (written != size) {
        std::cerr << "[FFmpegMuxer] Warning: Failed to write all bytes to pipe\n";
        stop();
        return false;
    }
    fflush(ffmpeg_pipe_);
    return true;
}

bool FFmpegMuxer::is_running() const {
    return running_;
}

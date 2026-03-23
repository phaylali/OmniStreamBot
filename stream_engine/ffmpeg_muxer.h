#ifndef FFMPEG_MUXER_H
#define FFMPEG_MUXER_H

#include <string>
#include <atomic>
#include <thread>
#include <cstdio>

class FFmpegMuxer {
public:
    FFmpegMuxer(const std::string& twitch_key, const std::string& kick_key);
    ~FFmpegMuxer();

    bool start();
    void stop();
    bool write_chunk(const char* data, size_t size);
    bool is_running() const;

private:
    std::string twitch_key_;
    std::string kick_key_;
    FILE* ffmpeg_pipe_;
    std::atomic<bool> running_;
};

#endif // FFMPEG_MUXER_H

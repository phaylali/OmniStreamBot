#include <iostream>
#include <map>
#include <string>
#include <mutex>
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>
#include <nlohmann/json.hpp>

#include "ffmpeg_muxer.h"

using server = websocketpp::server<websocketpp::config::asio>;
using json = nlohmann::json;

server echo_server;
std::mutex m_mutex;
std::unique_ptr<FFmpegMuxer> current_muxer;
websocketpp::connection_hdl current_streamer;

void on_message(websocketpp::connection_hdl hdl, server::message_ptr msg) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // Check if the message is binary (video/audio chunk)
    if (msg->get_opcode() == websocketpp::frame::opcode::binary) {
        if (current_muxer && current_muxer->is_running()) {
            // It's a binary chunk for the stream
            const std::string& payload = msg->get_payload();
            current_muxer->write_chunk(payload.data(), payload.size());
        }
        return;
    }

    // Otherwise it's text (control message)
    try {
        json command = json::parse(msg->get_payload());
        std::string action = command.value("action", "");

        if (action == "start") {
            std::cout << "[Server] Start stream request received\n";
            std::string twitch_key = command.value("twitchKey", "");
            std::string kick_key = command.value("kickKey", "");
            
            if (current_muxer) {
                current_muxer->stop();
            }
            
            current_muxer = std::make_unique<FFmpegMuxer>(twitch_key, kick_key);
            if (current_muxer->start()) {
                current_streamer = hdl;
                
                json res = {{"status", "started"}};
                echo_server.send(hdl, res.dump(), websocketpp::frame::opcode::text);
            } else {
                json res = {{"status", "error"}, {"message", "Failed to start FFmpeg"}};
                echo_server.send(hdl, res.dump(), websocketpp::frame::opcode::text);
            }
        } 
        else if (action == "stop") {
            std::cout << "[Server] Stop stream request received\n";
            if (current_muxer) {
                current_muxer->stop();
                current_muxer.reset();
            }
            json res = {{"status", "stopped"}};
            echo_server.send(hdl, res.dump(), websocketpp::frame::opcode::text);
        }
    } catch (const std::exception& e) {
        std::cerr << "Invalid message: " << msg->get_payload() << " (" << e.what() << ")\n";
    }
}

void on_close(websocketpp::connection_hdl hdl) {
    std::lock_guard<std::mutex> lock(m_mutex);
    // If the streamer disconnects, stop the muxer
    // We compare hdls using the owner pointer
    auto hdl1 = hdl.lock();
    auto hdl2 = current_streamer.lock();
    if (hdl1 && hdl1 == hdl2) {
        std::cout << "[Server] Streamer disconnected, stopping stream\n";
        if (current_muxer) {
            current_muxer->stop();
            current_muxer.reset();
        }
        current_streamer.reset();
    }
}

int main() {
    try {
        echo_server.set_access_channels(websocketpp::log::alevel::all);
        echo_server.clear_access_channels(websocketpp::log::alevel::frame_payload);

        echo_server.init_asio();

        echo_server.set_message_handler(&on_message);
        echo_server.set_close_handler(&on_close);

        std::cout << "[Server] Starting WebSocket server on port 3006...\n";
        echo_server.listen(3006);
        echo_server.start_accept();
        echo_server.run();
    } catch (websocketpp::exception const & e) {
        std::cerr << "WebSocket Exception: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "Unknown Exception" << std::endl;
    }
    return 0;
}

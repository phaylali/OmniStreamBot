cmake_minimum_required(VERSION 3.14)
project(omnistream_engine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(POLICY CMP0169)
  cmake_policy(SET CMP0169 OLD)
endif()

find_package(Threads REQUIRED)

include(FetchContent)

# Fetch standalone Asio
FetchContent_Declare(
    asio
    GIT_REPOSITORY https://github.com/chriskohlhoff/asio.git
    GIT_TAG asio-1-28-0
)
FetchContent_MakeAvailable(asio)

# Fetch WebSocket++
FetchContent_Declare(
    websocketpp
    GIT_REPOSITORY https://github.com/zaphoyd/websocketpp.git
    GIT_TAG 0.8.2
)
FetchContent_Populate(websocketpp)

# Fetch nlohmann_json
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.2
)
FetchContent_Populate(json)

add_executable(omnistream_engine main.cpp ffmpeg_muxer.cpp)

# Since we want standalone ASIO in WebSocket++:
target_compile_definitions(omnistream_engine PRIVATE ASIO_STANDALONE _WEBSOCKETPP_CPP11_STL_)

target_include_directories(omnistream_engine PRIVATE
    ${asio_SOURCE_DIR}/asio/include
    ${websocketpp_SOURCE_DIR}
    ${json_SOURCE_DIR}/single_include
)

target_link_libraries(omnistream_engine Threads::Threads)

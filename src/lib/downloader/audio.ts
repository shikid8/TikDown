import ffmpeg from "fluent-ffmpeg";
import { PassThrough, Readable } from "stream";

// Set FFMPEG_PATH if provided in environment
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Converts a video stream to an MP3 audio stream using ffmpeg.
 * @param videoStream The input video stream (NodeJS Readable)
 * @returns A PassThrough stream containing the MP3 audio
 */
export function extractAudioStream(videoStream: NodeJS.ReadableStream): PassThrough {
  const audioStream = new PassThrough();

  ffmpeg(videoStream as unknown as import("stream").Readable)
    .toFormat("mp3")
    .audioBitrate("128k")
    .on("error", (err) => {
      console.error("[FFmpeg] Error extracting audio:", err.message);
      audioStream.destroy(err);
    })
    .pipe(audioStream, { end: true });

  return audioStream;
}

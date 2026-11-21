import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';

const output = resolve(process.env.TUTORIAL_OUTPUT || 'tutorial-output');
const voice = JSON.parse(readFileSync(join(output, 'voice', 'manifest.json'), 'utf8'));
const frames = JSON.parse(readFileSync(join(output, 'boblar.json'), 'utf8'));
if (voice.length !== 15 || frames.length < 20) throw new Error('Video kadrlari yoki ovoz bo‘limlari yetishmayapti');

const cursor = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48"><path d="M3 2 3 39 12 31 19 46 27 42 20 27 34 27Z" fill="#fff" stroke="#111827" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
const cursorPath = join(output, 'cursor.png');
await sharp(Buffer.from(cursor)).png().toFile(cursorPath);

const countByChapter = new Map();
for (const frame of frames) countByChapter.set(frame.chapter, (countByChapter.get(frame.chapter) || 0) + 1);
const voiceByChapter = new Map(voice.map((item) => [item.number, item]));
const imageLines = [];
for (let index = 0; index < frames.length; index++) {
  const frame = frames[index];
  const image = join(output, 'frames', `${String(index + 1).padStart(2, '0')}-${frame.chapter}.png`).replaceAll('\\', '/');
  const seconds = voiceByChapter.get(frame.chapter).seconds / countByChapter.get(frame.chapter);
  imageLines.push(`file '${image.replaceAll("'", "'\\''")}'`, `duration ${seconds.toFixed(3)}`);
}
imageLines.push(imageLines.at(-2));
const imagesFile = join(output, 'voiced-frames.txt');
writeFileSync(imagesFile, imageLines.join('\n') + '\n');
const audioFile = join(output, 'voice', 'audio-list.txt');
writeFileSync(audioFile, voice.map((item) => `file '${item.file.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n') + '\n');

const total = voice.reduce((sum, item) => sum + item.seconds, 0);
const temporary = join(output, 'savdoza-tutorial-voiced.mp4');
execFileSync(ffmpeg, [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', imagesFile,
  '-loop', '1', '-i', cursorPath,
  '-f', 'concat', '-safe', '0', '-i', audioFile,
  '-filter_complex', "[0:v]fps=12,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[bg];[bg][1:v]overlay=x='(W-w)*(0.18+0.6*(0.5+0.5*sin(t*0.55)))':y='(H-h)*(0.25+0.5*(0.5+0.5*sin(t*0.37+1)))':eval=frame:shortest=1[v]",
  '-map', '[v]', '-map', '2:a', '-t', String(total), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', temporary,
], { stdio: 'inherit' });

let start = 0;
const chapters = voice.map((item) => {
  const chapter = { title: item.title.split(' · ')[0], start: Number(start.toFixed(2)) };
  start += item.seconds;
  return chapter;
});
writeFileSync(join(output, 'savdoza-tutorial.json'), JSON.stringify({ duration: Number(total.toFixed(2)), chapters, kind: 'actual-interface-sample-data', narration: 'uz-UZ-MadinaNeural' }, null, 2) + '\n');
const clock = (seconds) => {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
  const rest = String(Math.floor(seconds % 60)).padStart(2, '0');
  const millis = String(Math.round((seconds % 1) * 1000)).padStart(3, '0');
  return `${hours}:${minutes}:${rest}.${millis}`;
};
let position = 0;
const subtitles = ['WEBVTT', ''];
for (const item of voice) {
  subtitles.push(`${clock(position)} --> ${clock(position + item.seconds)}`, item.text, '');
  position += item.seconds;
}
writeFileSync(join(output, 'savdoza-tutorial.vtt'), subtitles.join('\n'));
console.log(JSON.stringify({ video: temporary, duration: total, chapters: chapters.length }));

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const output = resolve(process.env.TUTORIAL_OUTPUT || 'tutorial-output');
const chapters = JSON.parse(readFileSync(join(output, 'boblar.json'), 'utf8'));
const frames = chapters.map((item, index) => ({ ...item, file: join(output, 'frames', `${String(index + 1).padStart(2, '0')}-${item.chapter}.png`) }));
if (frames.some(item => !existsSync(item.file))) throw new Error('Video kadrlari yetishmayapti.');
const byChapter = new Map();
for (const item of frames) byChapter.set(item.chapter, [...(byChapter.get(item.chapter) || []), item]);
const voiceDir = join(output, 'elevenlabs-ovoz');
const audioFiles = [...byChapter.keys()].map(chapter => join(voiceDir, `${String(chapter).padStart(2, '0')}.mp3`));
const audioCount = audioFiles.filter(existsSync).length;
if (audioCount > 0 && audioCount !== audioFiles.length) throw new Error(`ElevenLabs ovoz fayllari ${audioCount}/${audioFiles.length}. Hamma bob uchun MP3 kerak.`);
const hasVoice = audioCount === audioFiles.length;
const audioDuration = file => {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const match = result.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!match) throw new Error(`Ovoz davomiyligi o‘qilmadi: ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};
const voiceDurations = hasVoice ? new Map([...byChapter.keys()].map((chapter, index) => [chapter, audioDuration(audioFiles[index])])) : null;
const captions = [];
let totalSeconds = 0;
for (const [chapter, images] of byChapter) {
  const text = readFileSync(join(output, 'ovoz-matnlari', `${String(chapter).padStart(2, '0')}.txt`), 'utf8').trim();
  const words = text.split(/\s+/);
  const chunkSize = 11;
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) chunks.push(words.slice(i, i + chunkSize).join(' '));
  const distribution = images.map(() => []);
  chunks.forEach((chunk, index) => distribution[Math.min(images.length - 1, Math.floor(index * images.length / chunks.length))].push(chunk));
  const chapterWords = Math.max(1, words.length);
  images.forEach((image, frameIndex) => {
    image.startSeconds = totalSeconds;
    const assigned = distribution[frameIndex];
    const assignedWords = assigned.reduce((sum, value) => sum + value.split(/\s+/).length, 0);
    image.seconds = hasVoice ? voiceDurations.get(chapter) * assignedWords / chapterWords : Math.max(8, assigned.reduce((sum, chunk) => sum + Math.max(3.5, chunk.split(/\s+/).length / 2.2), 0));
    let offset = 0;
    for (const chunk of assigned) {
      const duration = image.seconds * (chunk.split(/\s+/).length / assignedWords);
      captions.push({ start: totalSeconds + offset, end: totalSeconds + offset + duration, title: image.title, text: chunk });
      offset += duration;
    }
    totalSeconds += image.seconds;
  });
}
const clock = seconds => {
  const centiseconds = Math.round(seconds * 100);
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
};
const escape = value => value.replaceAll('\\', '/').replaceAll('{', '(').replaceAll('}', ')');
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 820\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Guide,Arial,25,&H00FFFFFF,&H00FFFFFF,&H001B273B,&H001B273B,0,0,0,0,100,100,0,0,1,0,0,2,30,30,17,1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n` + captions.map(item => `Dialogue: 0,${clock(item.start)},${clock(item.end)},Guide,,0,0,0,,{\\b1}${escape(item.title)}{\\b0}\\N${escape(item.text)}`).join('\n') + '\n';
const subtitleFile = join(output, 'subtitr.ass');
writeFileSync(subtitleFile, ass);
const concatFile = join(output, 'kadrlar-subtitr.txt');
writeFileSync(concatFile, frames.flatMap(item => [`file '${item.file.replaceAll('\\', '/')}'`, `duration ${item.seconds.toFixed(2)}`]).concat(`file '${frames.at(-1).file.replaceAll('\\', '/')}'`).join('\n') + '\n');
writeFileSync(join(output, 'boblar-subtitr.json'), JSON.stringify(frames.map(({ chapter, title, startSeconds, seconds }) => ({ chapter, title, startSeconds, seconds })), null, 2) + '\n');
const escaped = subtitleFile.replaceAll('\\', '/').replace(':', '\\:');
const video = join(output, hasVoice ? 'savdoza-video-ovozli.mp4' : 'savdoza-video-subtitrli.mp4');
const filter = `fps=12,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:820:(ow-iw)/2:0:color=0x13283e,subtitles='${escaped}'`;
if (hasVoice) {
  const audioConcat = join(output, 'ovozlar.txt');
  writeFileSync(audioConcat, audioFiles.map(file => `file '${file.replaceAll('\\', '/')}'`).join('\n') + '\n');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', audioConcat, '-c', 'copy', join(output, 'ovozlar-birlashgan.mp3')], { stdio: 'inherit' });
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatFile, '-i', join(output, 'ovozlar-birlashgan.mp3'), '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video], { stdio: 'inherit' });
} else {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatFile, '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video], { stdio: 'inherit' });
}
console.log(JSON.stringify({ seconds: Math.round(totalSeconds), video, captions: captions.length, elevenLabsVoice: hasVoice }));


// Helper to convert AudioBuffer to WAV Blob
function bufferToWav(abuffer: AudioBuffer, len: number) {
  let numOfChan = abuffer.numberOfChannels;
  let length = len * numOfChan * 2 + 44;
  let buffer = new ArrayBuffer(length);
  let view = new DataView(buffer);
  let channels = [], i, sample, offset = 0, pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this tokenizer)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < len) {
    for(i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);          // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], {type: "audio/wav"});

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error("Failed to convert blob to base64"));
        }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function extractAudioFromVideo(file: File): Promise<string | null> {
  try {
    // 1. Get ArrayBuffer from file
    const arrayBuffer = await file.arrayBuffer();
    
    // 2. Decode Audio Data
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 3. Optimization: Downsample to 16kHz for faster processing and smaller payload
    // 16kHz is sufficient for speech and trigger detection
    const targetSampleRate = 16000;
    const maxDuration = 180; // Limit to 3 minutes for optimized analysis
    const durationToUse = Math.min(originalBuffer.duration, maxDuration);
    
    const offlineCtx = new OfflineAudioContext(
      1, // Mono is enough for analysis
      durationToUse * targetSampleRate,
      targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const resampledBuffer = await offlineCtx.startRendering();

    // 4. Convert to WAV
    const wavBlob = bufferToWav(resampledBuffer, resampledBuffer.length);
    
    // 5. Convert to Base64
    const base64Audio = await blobToBase64(wavBlob);
    
    return base64Audio;
  } catch (e) {
    console.warn("Audio extraction failed (video might be silent or too large):", e);
    return null;
  }
}

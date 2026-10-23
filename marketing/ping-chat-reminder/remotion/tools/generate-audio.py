"""Original deterministic music and UI tones for this Ping video. No downloaded samples."""
from pathlib import Path
import numpy as np
import wave,json
RATE=48000
OUT=Path(__file__).resolve().parents[1]/'public/audio'
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(16102026)
def note(m): return 440*2**((m-69)/12)
def save(name,data):
 data=np.asarray(data)
 if data.ndim==1:data=np.column_stack([data,data])
 data=np.clip(data,-.95,.95)
 with wave.open(str(OUT/name),'wb') as w:
  w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((data*32767).astype('<i2').tobytes())
 return {'file':name,'seconds':len(data)/RATE,'samplePeakDBFS':float(20*np.log10(max(np.abs(data).max(),1e-8)))}
def bell(m,duration=1.2,amp=1):
 t=np.arange(int(RATE*duration))/RATE;f=note(m)
 attack=1-np.exp(-t*160)
 return amp*attack*np.exp(-t*4)*(np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*f*2.005*t)+.08*np.sin(2*np.pi*f*3*t))
def add(buf,sound,time,pan=0):
 start=int(time*RATE);n=min(len(sound),len(buf)-start)
 if n<=0:return
 buf[start:start+n,0]+=sound[:n]*np.sqrt((1-pan)/2)
 buf[start:start+n,1]+=sound[:n]*np.sqrt((1+pan)/2)
music=np.zeros((RATE*30,2));beat=.625
chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59],[48,55,59,64],[43,50,55,62]]
for section,chord in enumerate(chords):
 start=section*5
 t=np.arange(int(RATE*5.4))/RATE
 envelope=np.minimum(t/.55,1)*np.minimum(np.maximum((5.4-t)/.75,0),1)
 pad=sum(np.sin(2*np.pi*note(n)*t+.08*np.sin(2*np.pi*.35*t)) for n in chord)/len(chord)
 add(music,pad*envelope*.052,start,(-1)**section*.3)
 for k in range(8):
  m=chord[[2,3,1,3,2,3,1,2][k]]+12
  add(music,bell(m,1.5,.055),start+k*beat,(-1)**k*.36)
 for k in [0,2,4,6]:
  t=np.arange(int(RATE*.24))/RATE
  kick=np.sin(2*np.pi*(48*t+9*(1-np.exp(-t*22))/22))*np.exp(-t*22)*.055
  add(music,kick,start+k*beat)
 for k in range(8):
  t=np.arange(int(RATE*.06))/RATE
  brush=rng.normal(0,1,len(t))*np.exp(-t*65)*.004
  add(music,brush,start+k*beat+.3125,.2)
# A small, original, resolving melodic phrase. It does not imitate a platform notification.
for time,m in [(1.25,76),(3.75,74),(6.25,72),(8.75,76),(11.25,69),(13.75,72),(16.25,71),(18.75,74),(21.25,76),(23.75,79),(26.25,76),(28.1,72)]:
 add(music,bell(m,1.7,.038),time,-.2)
t=np.arange(RATE*30)/RATE
music*=np.minimum(t/.7,1)[:,None]*np.minimum(np.maximum((30-t)/1.6,0),1)[:,None]
manifest=[save('music-original.wav',music)]
t=np.arange(int(RATE*.085))/RATE
click=(np.sin(2*np.pi*920*t)*.11+rng.normal(0,1,len(t))*.025)*np.exp(-t*85)*(1-np.exp(-t*2000))
manifest.append(save('tap.wav',click))
copy=np.zeros((int(RATE*.3),2));add(copy,bell(83,.15,.14),.0,-.12);add(copy,bell(88,.15,.1),.08,.12)
manifest.append(save('copy.wav',copy))
t=np.arange(int(RATE*.38))/RATE
noise=rng.normal(0,1,len(t));smooth=np.convolve(noise,np.ones(12)/12,mode='same')
whoosh=smooth*np.sin(np.pi*t/.38)**2*.07
manifest.append(save('move.wav',whoosh))
ping=np.zeros((int(RATE*1.2),2))
for i,m in enumerate([76,79,83]):add(ping,bell(m,1,.16),i*.11,(-.2+i*.2))
manifest.append(save('ping.wav',ping))
message=np.zeros((int(RATE*.65),2));add(message,bell(79,.6,.13),0,-.1);add(message,bell(76,.45,.09),.08,.1)
manifest.append(save('message.wav',message))
(OUT/'provenance.json').write_text(json.dumps({'source':'Locally synthesized original instrumental and UI tones','generator':'tools/generate-audio.py','seed':16102026,'bpm':96,'sampleRate':RATE,'files':manifest},ensure_ascii=False,indent=2))
print(json.dumps(manifest,indent=2))

"""Build original, illustrative marketing media locally using Pillow + GStreamer.
No real customer data, claims, external footage, or production database access.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import gi, math, html
gi.require_version('Gst', '1.0')
from gi.repository import Gst
Gst.init(None)
OUT = Path(__file__).resolve().parents[1] / 'public' / 'media'
OUT.mkdir(parents=True, exist_ok=True)
W,H,FPS,SECONDS=1280,720,24,24
NAVY='#193e33'; INK='#193e33'; INDIGO='#699374'; MUTED='#708177'; GREEN='#438462'
fonts={}
def font(n,bold=False):
 key=(n,bold)
 if key not in fonts: fonts[key]=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',n)
 return fonts[key]
def ease(value):
 value=max(0,min(1,value)); return value*value*(3-2*value)
def product_art(d,x,y,i):
 # Six distinct original illustrations, subtle ground shadow, labelled packaging.
 d.ellipse((x+49,y+56,x+121,y+66),fill='#d0d9c9')
 if i==0:
  d.polygon([(x+67,y+15),(x+96,y+15),(x+107,y+25),(x+107,y+60),(x+65,y+60),(x+65,y+25)],fill='#fffefa')
  d.polygon([(x+96,y+15),(x+107,y+25),(x+107,y+60),(x+96,y+55)],fill='#dbe5d4')
  d.rectangle((x+65,y+34,x+96,y+50),fill='#699374')
  d.text((x+71,y+38),'SUT',font=font(8,True),fill='white')
  d.line((x+67,y+15,x+96,y+15),fill='#699374',width=4)
 elif i==1:
  d.rounded_rectangle((x+49,y+31,x+121,y+59),15,fill='#c59155')
  d.rounded_rectangle((x+51,y+28,x+119,y+53),14,fill='#e3b574')
  for a in [65,81,97]:d.line((x+a,y+32,x+a-5,y+45),fill='#f8dfac',width=4)
  for a,b in [(58,42),(108,40),(88,49)]:d.ellipse((x+a,y+b,x+a+2,y+b+2),fill='#bd854b')
 elif i==2:
  d.ellipse((x+59,y+27,x+89,y+58),fill='#b9654e');d.ellipse((x+79,y+26,x+108,y+58),fill='#c97b5c')
  d.line((x+84,y+31,x+88,y+17),fill='#6c6942',width=3)
  d.ellipse((x+89,y+14,x+104,y+23),fill='#699374')
  d.arc((x+65,y+31,x+79,y+49),150,260,fill='#e3a183',width=2)
 elif i==3:
  d.rounded_rectangle((x+60,y+19,x+111,y+61),4,fill='#3d6c51')
  d.rectangle((x+64,y+23,x+107,y+56),fill='#719271')
  d.ellipse((x+76,y+29,x+96,y+46),fill='#e6e8c8');d.line((x+82,y+40,x+91,y+32),fill='#699374',width=2)
  d.text((x+73,y+48),'CHOY',font=font(7,True),fill='white')
 elif i==4:
  d.rounded_rectangle((x+76,y+14,x+94,y+23),3,fill='#537952')
  d.polygon([(x+77,y+23),(x+93,y+23),(x+104,y+33),(x+104,y+60),(x+66,y+60),(x+66,y+33)],fill='#e9bd59')
  d.rectangle((x+68,y+38,x+103,y+52),fill='#f8f3d6');d.text((x+74,y+42),'YOG‘',font=font(8,True),fill='#6b7950')
  d.line((x+73,y+29,x+73,y+36),fill='#f6d98f',width=3)
 else:
  d.polygon([(x+65,y+18),(x+105,y+18),(x+111,y+59),(x+59,y+59)],fill='#fcfaf2')
  d.line((x+65,y+18,x+105,y+18),fill='#bfab83',width=4)
  d.rectangle((x+62,y+35,x+108,y+50),fill='#bba47c');d.text((x+67,y+39),'SHAKAR',font=font(7,True),fill='white')
def screen(t, transitions=True):
 im=Image.new('RGB',(W,H),'#eef2e9');d=ImageDraw.Draw(im)
 def box(x,y,w,h,fill='#fff',rad=16,outline=None): d.rounded_rectangle((x,y,x+w,y+h),rad,fill=fill,outline=outline)
 def text(x,y,s,n=18,c=INK,b=False): d.text((x,y),s,font=font(n,b),fill=c)
 scene=min(3,int(t//6)); phase=t%6
 # Header and app shell
 text(48,26,'savdoza',28,INK,True)
 box(1030,25,202,34,'#dce8d8',17);text(1050,32,'NAMUNAVIY DEMO',12,INDIGO,True)
 titles=["Hisob ochishdan boshlang.","Mahsulotni toping. Savatga qo‘shing.","To‘lovni yakunlang. Chek tayyor.","Savdoni bir joydan kuzating."]
 text(48,82,titles[scene],32,INK,True)
 descriptions=["Ro‘yxatdan o‘tish → admin tasdig‘i → tarifni faollashtirish", "Shtrix-kod yoki mahsulot nomi orqali tezkor qidiruv", "Naqd va karta to‘lovlari, qoldiqning yangilanishi", "Savdo, ombor va hisobotlar uchun yagona boshqaruv paneli"]
 text(48,130,descriptions[scene],17,MUTED)
 box(48,180,1184,468,'#ffffff',20)
 box(48,180,205,468,NAVY,20)
 d.rectangle((230,180,253,648),fill=NAVY)
 text(72,207,'SAVDOZA',18,'white',True)
 text(72,235,'DEMO DO‘KON',10,'#a8beb1',True)
 nav=['Dashboard','POS terminal','Mahsulotlar','Ombor','Mijozlar','Hisobotlar']
 active=0 if scene==3 else 1
 for i,label in enumerate(nav):
  y=284+i*48
  if i==active: box(64,y-7,171,36,INDIGO,9)
  text(80,y,label,13,'white' if i==active else '#b2c5b8',i==active)
 text(76,611,'●  Demo ko‘rinish',11,'#b2c5b8')
 if scene==0:
  text(288,207,'Boshlash uchun 3 qadam',23,INK,True)
  text(288,245,'Barcha bosqichlar hisobingizda ko‘rinadi.',14,MUTED)
  steps=[('01','Hisob yarating','Ism, telefon, email, login va parol'),('02','Tasdiqni kuting','Arizangizni superadmin ko‘rib chiqadi'),('03','Tarifni tanlang','Pro yoki Max bilan ish boshlang')]
  for i,(num,title,desc) in enumerate(steps):
   y=300+i*96; selected=phase>=i*1.5
   box(288,y,889,78,'#e6eee0' if selected else '#f5f7f1',12)
   box(308,y+16,44,44,INDIGO if selected else '#e2e8dd',12)
   text(318,y+29,num,13,'white' if selected else MUTED,True)
   text(373,y+15,title,18,INK,True);text(373,y+43,desc,13,MUTED)
 elif scene in (1,2):
  text(281,204,'POS terminal',23,INK,True)
  box(281,250,542,42,'#f0f3ed',10);text(300,262,'Mahsulot nomi yoki shtrix-kod…',13,MUTED)
  names=['Sut 1 L','Non','Olma 1 kg','Choy','Yog‘ 1 L','Shakar 1 kg'];prices=[12000,4000,18000,16000,22000,14000]
  colors=['#e7ede1','#fff1d8','#e5f5e9','#e4f3ef','#fff1d7','#f1e9dc']
  for i,name in enumerate(names):
   x=281+(i%3)*185;y=311+(i//3)*148
   box(x,y,170,133,'#fff',12,'#dfe6da')
   box(x+10,y+10,150,63,colors[i],8)
   product_art(d,x,y,i)
   if scene==1 and int(phase//1.5)==i and phase%1.5<.45:
    pulse=1-ease((phase%1.5)/.45)
    d.rounded_rectangle((x,y,x+170,y+133),12,outline='#699374',width=max(1,round(3*pulse)))
   text(x+13,y+83,name,13,INK,True);text(x+13,y+105,f'{prices[i]:,}'.replace(',',' ')+' so‘m',12,MUTED)
  d.line((850,200,850,628),fill='#dfe6da',width=1)
  text(878,207,'Joriy savat',19,INK,True)
  n=min(3,max(1,int(phase//1.5)+1)) if scene==1 else 3
  for i in range(n):
   y=268+i*61;text(878,y,names[i],14,INK,True);text(878,y+23,'1 dona',11,MUTED);text(1090,y,f'{prices[i]:,}'.replace(',',' '),14)
   d.line((878,y+48,1194,y+48),fill='#e3e9de')
  total=sum(prices[:n]);text(878,478,'Jami',15,MUTED);text(1036,471,f'{total:,}'.replace(',',' ')+' so‘m',21,INK,True)
  box(878,521,153,39,'#e1ebdb',9);text(927,533,'Naqd',13,INDIGO,True)
  box(1041,521,153,39,'#f0f3ed',9);text(1091,533,'Karta',13,MUTED)
  box(878,580,316,44,INDIGO,10);text(956,594,'To‘lovni yakunlash',13,'white',True)
  if scene==2 and phase>1:
   d.rectangle((254,180,1231,647),fill='#edf2e8')
   box(552,207,397,415,'white',18)
   d.ellipse((711,230,782,301),fill='#e0efdc');d.line((730,265,743,279,764,251),fill=GREEN,width=5)
   text(624,319,'Savdo yakunlandi',22,INK,True)
   text(652,357,'NAMUNAVIY CHEK',12,MUTED,True)
   for i in range(3):
    y=397+i*35;text(583,y,names[i]+' × 1',13,INK);text(838,y,f'{prices[i]:,}'.replace(',',' '),13)
   d.line((583,509,917,509),fill='#dfe6da');text(583,530,'Jami',18,INK,True);text(790,530,'34 000 so‘m',18,INDIGO,True)
   text(619,582,'Bu fiskal chek emas',12,MUTED)
 else:
  text(281,205,'Biznesingiz bugun',23,INK,True)
  text(281,242,'Ko‘rsatkichlar — tushuntirish uchun namuna',12,MUTED)
  for i,(label,value) in enumerate([('Savdo summasi','1 240 000 so‘m'),('Cheklar','24 ta'),('Omborda','186 dona')]):
   x=281+i*309;box(x,282,289,92,'#f1f5ed',12);text(x+20,299,label,13,MUTED);text(x+20,330,value,23,INK,True)
  text(281,399,'Savdo dinamikasi',17,INK,True)
  heights=[55,80,61,119,98,151,131,168,140,177,159,188]
  prog=ease(phase/2)
  for i,h in enumerate(heights):
   x=290+i*48;box(x,610-h*prog,27,h*prog,INDIGO if i>7 else '#becfb3',5)
  box(922,399,270,222,'#f2f5ee',12);text(942,419,'Tezkor nazorat',16,INK,True)
  for i,(label,detail) in enumerate([('Ombor qoldig‘i','Mahsulotlar holati'),('Yaroqlilik muddati','Partiyalar nazorati'),('Mijozlar','Savdo tarixi')]):
   y=461+i*50;d.ellipse((943,y+5,951,y+13),fill=GREEN);text(965,y,label,13,INK,True);text(965,y+20,detail,11,MUTED)
 # bottom progression
 for i,label in enumerate(['Hisob','Savat','To‘lov','Tahlil']):
  x=48+i*304
  box(x,675,278,3,'#d4dfcd',1)
  if i==scene: box(x,675,278*min(1,phase/6),3,INDIGO,1)
  elif i<scene: box(x,675,278,3,INDIGO,1)
  text(x,688,'0'+str(i+1)+'  '+label,10,INDIGO if i==scene else MUTED,True)
 # Animated pointer and click rings explain the action without external footage.
 paths=[[(.4,1120,340),(1.5,1120,435),(3,1120,531),(5.6,1120,531)],
        [(.2,370,365),(1.5,550,365),(3,735,365),(4.7,1040,599),(5.8,1040,599)],
        [(.1,1040,599),(.8,1040,599),(2,967,563),(5.8,967,563)],
        [(.2,510,352),(2,700,459),(4,1020,471),(5.8,1020,471)]]
 path=paths[scene];cx,cy=path[0][1:]
 for j in range(len(path)-1):
  start,sx,sy=path[j];end,ex,ey=path[j+1]
  if phase>=start:
   v=ease((phase-start)/(end-start));cx=sx+(ex-sx)*v;cy=sy+(ey-sy)*v
 if not (scene==2 and phase>1.4):
  for at,px,py in path:
   dt=phase-at
   if 0<=dt<.4:
    r=6+24*ease(dt/.4)
    d.ellipse((px-r,py-r,px+r,py+r),outline='#a9c296',width=2)
  points=[(cx,cy),(cx+3,cy+25),(cx+10,cy+19),(cx+17,cy+30),(cx+23,cy+26),(cx+16,cy+16),(cx+27,cy+13)]
  d.polygon(points,fill='#193e33');d.line(points+[points[0]],fill='white',width=2)
 if transitions and scene>0 and phase<.45:
  previous=screen(scene*6-.001,False)
  im=Image.blend(previous,im,ease(phase/.45))
 return im
screen(3).save(OUT/'demo-poster.webp',quality=90)
screen(8).save(OUT/'pos-preview.webp',quality=90)
screen(21).save(OUT/'dashboard-preview.webp',quality=90)
pipeline=Gst.parse_launch(f'appsrc name=src format=time is-live=false block=true caps=video/x-raw,format=RGB,width={W},height={H},framerate={FPS}/1 ! videoconvert ! vp8enc deadline=1 cpu-used=4 target-bitrate=1400000 keyframe-max-dist=48 ! webmmux ! filesink location="{OUT / "savdoza-demo.webm"}"')
source=pipeline.get_by_name('src')
pipeline.set_state(Gst.State.PLAYING)
for i in range(SECONDS*FPS):
 data=screen(i/FPS).tobytes();buf=Gst.Buffer.new_allocate(None,len(data),None);buf.fill(0,data);buf.pts=i*Gst.SECOND//FPS;buf.duration=Gst.SECOND//FPS
 result=source.emit('push-buffer',buf)
 if result!=Gst.FlowReturn.OK: raise RuntimeError(result)
source.emit('end-of-stream')
msg=pipeline.get_bus().timed_pop_filtered(60*Gst.SECOND,Gst.MessageType.EOS|Gst.MessageType.ERROR)
if not msg: raise RuntimeError('Video encoder timeout')
if msg.type==Gst.MessageType.ERROR: raise RuntimeError(msg.parse_error())
pipeline.set_state(Gst.State.NULL)
print('Created 24s, 1280×720, 24fps VP8/WebM demo and 3 posters')
# Editable original SVG product scene, separate from the video renderer.
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="780" viewBox="0 0 1200 780" role="img" aria-labelledby="title desc">', '<title id="title">Savdoza POS — namunaviy ko‘rinish</title><desc id="desc">Mahsulotlar, savat va savdo nazorati uchun original interfeys illyustratsiyasi. Haqiqiy mijoz ma’lumotlari ishlatilmagan.</desc>', '<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#e1ebdb"/><stop offset="1" stop-color="#f5f7ef"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#193e33" flood-opacity=".12"/></filter></defs>', '<rect width="1200" height="780" rx="32" fill="url(#bg)"/>','<g filter="url(#shadow)"><rect x="50" y="50" width="1100" height="670" rx="20" fill="white"/></g>','<path d="M70 50H246V720H70Q50 720 50 700V70Q50 50 70 50" fill="#193e33"/>','<g font-family="Arial, sans-serif">','<text x="78" y="97" font-size="24" font-weight="700" fill="white">savdoza.</text>','<text x="78" y="121" font-size="10" letter-spacing="2" fill="#a8beb1">DEMO DO‘KON</text>']
for i,lab in enumerate(['Dashboard','POS terminal','Mahsulotlar','Ombor','Mijozlar','Hisobotlar']):
 y=182+i*52
 if i==1: parts.append(f'<rect x="66" y="{y-25}" width="164" height="40" rx="9" fill="#699374"/>')
 parts.append(f'<text x="82" y="{y}" font-size="14" fill="{"white" if i==1 else "#b2c5b8"}">{lab}</text>')
parts += ['<text x="278" y="102" fill="#193e33" font-size="27" font-weight="700">POS terminal</text>','<rect x="953" y="75" width="164" height="30" rx="15" fill="#e1ebdb"/><text x="971" y="95" font-size="10" fill="#699374" letter-spacing="1">NAMUNAVIY DEMO</text>','<rect x="278" y="132" width="540" height="44" rx="11" fill="#f0f3ed"/><text x="296" y="159" fill="#708177" font-size="14">Mahsulot nomi yoki shtrix-kod...</text>']
for i,(name,price,color) in enumerate([('Sut 1 L','12 000','#e7ede1'),('Non','4 000','#fff1d8'),('Olma 1 kg','18 000','#e5f5e9'),('Choy','16 000','#e4f3ef'),('Yog‘ 1 L','22 000','#fff1d7'),('Shakar 1 kg','14 000','#f1e9dc')]):
 x=278+(i%3)*185;y=198+(i//3)*214
 parts += [f'<rect x="{x}" y="{y}" width="170" height="194" rx="12" fill="white" stroke="#dfe6da"/>',f'<rect x="{x+10}" y="{y+10}" width="150" height="112" rx="8" fill="{color}"/>']
 if i==1:parts.append(f'<rect x="{x+36}" y="{y+55}" width="98" height="38" rx="19" fill="#d8a269"/><path d="M{x+62} {y+63}l-6 19M{x+87} {y+63}l-6 19M{x+111} {y+63}l-6 19" stroke="#f5d4ac" stroke-width="5"/>')
 elif i==2:parts.append(f'<circle cx="{x+87}" cy="{y+73}" r="29" fill="#59a876"/><path d="M{x+87} {y+45}q0-20 18-18" stroke="#386d4d" stroke-width="5" fill="none"/>')
 else:parts.append(f'<rect x="{x+57}" y="{y+29}" width="57" height="80" rx="7" fill="white"/><rect x="{x+57}" y="{y+55}" width="57" height="28" fill="#699374"/><rect x="{x+68}" y="{y+63}" width="35" height="3" fill="white" opacity=".8"/>')
 parts += [f'<text x="{x+14}" y="{y+150}" font-size="15" fill="#193e33" font-weight="700">{name}</text>',f'<text x="{x+14}" y="{y+176}" font-size="14" fill="#708177">{price} so‘m</text>']
parts+=['<path d="M845 132V676" stroke="#dfe6da"/>','<text x="870" y="159" font-size="20" font-weight="700" fill="#193e33">Joriy savat</text>']
for i,(name,price) in enumerate([('Sut 1 L','12 000'),('Non','4 000'),('Olma 1 kg','18 000')]):
 y=219+i*80;parts += [f'<text x="870" y="{y}" font-size="15" fill="#193e33">{name}</text>',f'<text x="870" y="{y+25}" font-size="12" fill="#708177">1 dona</text>',f'<text x="1108" y="{y}" text-anchor="end" font-size="15" fill="#193e33">{price}</text>',f'<path d="M870 {y+43}H1110" stroke="#e3e9de"/>']
parts += ['<text x="870" y="510" font-size="14" fill="#708177">Jami</text>','<text x="1110" y="510" text-anchor="end" font-size="24" font-weight="700" fill="#193e33">34 000 so‘m</text>','<rect x="870" y="546" width="112" height="42" rx="9" fill="#e1ebdb"/><text x="926" y="572" text-anchor="middle" font-size="14" fill="#699374">Naqd</text>','<rect x="994" y="546" width="116" height="42" rx="9" fill="#f0f3ed"/><text x="1052" y="572" text-anchor="middle" font-size="14" fill="#708177">Karta</text>','<rect x="870" y="612" width="240" height="48" rx="10" fill="#699374"/><text x="990" y="642" text-anchor="middle" font-size="14" fill="white" font-weight="700">To‘lovni yakunlash</text>','</g></svg>']
svg='\n'.join(parts)
# Small original label illustrations make the four packaged products recognizable.
labels=[(0,'SUT'),(3,'CHOY'),(4,'YOG‘'),(5,'SHAKAR')]
label_markup=[]
for i,label in labels:
 x=278+(i%3)*185;y=198+(i//3)*214
 label_markup.append(f'<text x="{x+85}" y="{y+76}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="white">{label}</text>')
svg=svg.replace('</svg>', ''.join(label_markup)+'</svg>')
(OUT/'pos-illustration.svg').write_text(svg)
(OUT/'demo-captions.vtt').write_text('''WEBVTT

00:00.000 --> 00:06.000
Hisob yarating. Admin tasdig‘ini kuting. Pro yoki Max tarifini tanlang.

00:06.000 --> 00:12.000
Mahsulotni nomi yoki shtrix-kodi orqali toping va savatga qo‘shing.

00:12.000 --> 00:18.000
To‘lovni yakunlang. Chek yaratiladi, ombor qoldig‘i yangilanadi.

00:18.000 --> 00:24.000
Savdo, ombor va hisobotlarni yagona panel orqali kuzating. Barcha ko‘rsatkichlar namunaviy.
''')

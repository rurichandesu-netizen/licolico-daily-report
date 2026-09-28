

import React, { useState, useEffect, useRef } from 'react';

const MENU_DATA: Record<string, string[]> = {
  '2026-09-01': ['豚肉と野菜の旨味噌炒め', 'オムレツ'],
  '2026-09-02': ['肉団子と白菜旨煮', '海老イカカツ'],
  '2026-09-03': ['鶏天', '春雨の中華煮'],
  '2026-09-04': ['白身魚の天ぷら', '揚げ出し豆腐のそぼろあん'],
  '2026-09-07': ['トンカツ', '豆腐ステーキ'],
  '2026-09-08': ['春巻', '海老肉シューマイ'],
  '2026-09-09': ['豚肉甘酢焼き', 'カボチャコロッケ'],
  '2026-09-10': ['鶏の親子煮', 'コンニャクとわかめのピリ辛炒め'],
  '2026-09-11': ['チンジャオロースー', 'ウインナーの玉子炒め'],
  '2026-09-14': ['鶏の唐揚げ', '人参とハムの甘酢炒め'],
};

export default function LicoLicoDailyReport() {
  const [targetDate, setTargetDate] = useState('2026-09-09');
  const [weather, setWeather] = useState('＿＿');
  const [images, setImages] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [aiText, setAiText] = useState('');
  const [specialNotice, setSpecialNotice] = useState('');
  const [layoutMode, setLayoutMode] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const getDayWithWeek = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const weeks = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weeks[d.getDay()]}）`;
  };

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=34.93&longitude=135.76&current_weather=true&timezone=Asia%2FTokyo');
        if (!res.ok) throw new Error();
        const data = await res.json();
        const code = data.current_weather?.weathercode;
        let wStr = '晴れ';
        if ([1, 2, 3].includes(code)) wStr = 'くもり';
        else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) wStr = '雨';
        setWeather(wStr);
      } catch {
        setWeather('＿＿');
      }
    }
    fetchWeather();
  }, [targetDate]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 800;
        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (e) => reject(e);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    try {
      const compressed = await Promise.all(files.map(compressImage));
      setImages((prev) => [...prev, ...compressed]);
    } catch {
      alert('写真の読み込みに失敗しました。');
    }
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const newArr = [...images];
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setImages(newArr);
  };

  const handleReplaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || replaceIndex === null) return;
    try {
      const newImg = await compressImage(e.target.files[0]);
      setImages((prev) => {
        const copy = [...prev];
        copy[replaceIndex] = newImg;
        return copy;
      });
    } catch {
      alert('差替に失敗しました。');
    } finally {
      setReplaceIndex(null);
    }
  };

  const formatSpecialNotice = () => {
    if (!specialNotice) return;
    const base = new Date(targetDate);
    const tomorrow = new Date(base);
    tomorrow.setDate(base.getDate() + 1);
    const dayAfter = new Date(base);
    dayAfter.setDate(base.getDate() + 2);
    const weeks = ['日', '月', '火', '水', '木', '金', '土'];
    let text = specialNotice;
    if (text.includes('明日明後日')) {
      text = text.replace('明日明後日', `${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日（${weeks[tomorrow.getDay()]}）・${dayAfter.getMonth() + 1}月${dayAfter.getDate()}日（${weeks[dayAfter.getDay()]}）`);
    } else if (text.includes('明日')) {
      text = text.replace('明日', `${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日（${weeks[tomorrow.getDay()]}）`);
    }
    setSpecialNotice(text);
  };

  const generateAIText = async () => {
    if (images.length === 0 && !memo.trim()) {
      alert('写真を選択するか、メモを入力してください。');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, memo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'エラー');
      setAiText(data.result);
    } catch (err: any) {
      alert(err.message || '本文を作成できませんでした。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const getGridClass = (count: number) => {
    if (layoutMode === 'equal') return 'grid-cols-3';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count === 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const currentMenu = MENU_DATA[targetDate] || [];

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 text-slate-800">
      <div className="no-print max-w-xl mx-auto bg-white p-4 rounded-xl shadow-md mb-6 space-y-4">
        <h1 className="text-xl font-bold text-center border-b pb-2 text-slate-700">LicoLico 連絡帳作成</h1>
        <div>
          <label className="block text-sm font-semibold mb-1">① 日付選択</label>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full border rounded-lg p-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">② 写真の選択（複数・9枚OK）</label>
          <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="w-full border rounded-lg p-2 text-sm" />
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative border rounded p-1 bg-slate-50">
                  <img src={img} className="w-full h-16 object-contain" alt={`選んだ写真${idx + 1}`} />
                  <div className="flex justify-between mt-1">
                    <button onClick={() => moveImage(idx, 'left')} disabled={idx === 0} className="px-1 bg-slate-200 text-xs rounded disabled:opacity-30">←</button>
                    <button onClick={() => { setReplaceIndex(idx); replaceInputRef.current?.click(); }} className="px-1 bg-amber-200 text-xs rounded">差替</button>
                    <button onClick={() => moveImage(idx, 'right')} disabled={idx === images.length - 1} className="px-1 bg-slate-200 text-xs rounded disabled:opacity-30">→</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" ref={replaceInputRef} onChange={handleReplaceUpload} className="hidden" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">③ 本文・箇条書きメモ（任意）</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="文章でも箇条書きでもOKです。例：&#13;&#10;・午前は袋詰め&#13;&#10;・午後はパーツ仕分け&#13;&#10;・みんなで作業" className="w-full border rounded-lg p-2 text-sm h-20" />
        </div>
        <button onClick={generateAIText} disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow transition disabled:opacity-50">
          {isLoading ? 'AIが写真とメモを確認中...' : '⑤ 写真・メモから本文を作る'}
        </button>
        <div>
          <label className="block text-sm font-semibold mb-1">⑦ 整えた本文（手直し可能）</label>
          <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="AIで整えた本文がここに入ります。必要ならこのまま手直しできます。" className="w-full border rounded-lg p-2 text-sm h-24" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">④ 特記事項・連絡事項（ある時だけ）</label>
          <textarea value={specialNotice} onChange={(e) => setSpecialNotice(e.target.value)} onBlur={formatSpecialNotice} placeholder="例：明日明後日は臨時休業となっております。" className="w-full border rounded-lg p-2 text-sm h-16" />
        </div>
        <button onClick={() => window.print()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition">⑩ Safariから印刷またはPDF保存する</button>
      </div>

      <div className="print-page bg-white mx-auto shadow-2xl relative flex flex-col justify-between" style={{ width: '182mm', minHeight: '257mm', height: '257mm', padding: '12mm 10mm 10mm 16mm', boxSizing: 'border-box' }}>
        <div className="absolute left-[8mm] top-0 bottom-0 border-l border-dashed border-slate-200 pointer-events-none" />
        <div className="flex justify-between items-end border-b-2 border-slate-700 pb-1 mb-2">
          <div className="text-base font-bold text-slate-800">{getDayWithWeek(targetDate)}</div>
          <div className="text-sm font-semibold text-slate-700">京都市伏見区の天気：{weather}</div>
        </div>
        <div className="flex-1 my-1 flex items-center justify-center overflow-hidden min-h-[90mm] max-h-[110mm]">

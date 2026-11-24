'use strict';
/* =========================================================
 * I18N — 한국어 / 日本語 / English
 * 한국어 원문을 열쇠로 쓰고, ja · en 번역이 없으면 원문을 그대로 보여준다.
 *  T('원문')                 → 현재 언어 문구
 *  T('노트 {n}개', { n: 3 }) → {이름} 자리에 값 채우기
 * ========================================================= */
const I18N = (() => {
  const DICT = {
    /* ---------- 메뉴 · 공통 ---------- */
    '일시정지': ['一時停止', 'Pause'],
    '비공식 팬메이드 · 비영리 · Mrs. GREEN APPLE 및 소속사와 관계없음': ['非公式ファンメイド · 非営利 · Mrs. GREEN APPLE および所属事務所とは無関係です', 'Unofficial fan-made · Non-profit · Not affiliated with Mrs. GREEN APPLE or their agency'],
    '안내': ['案内', 'Notice'],
    '유튜브': ['YouTube', 'YouTube'],
    '+ 음악 파일': ['+ 音楽ファイル', '+ Music file'],
    '음악 파일': ['音楽ファイル', 'Music file'],
    '음악 파일 추가': ['音楽ファイルを追加', 'Add a music file'],
    '유튜브 영상 추가': ['YouTube動画を追加', 'Add a YouTube video'],
    '음악 파일을 창에 끌어다 놓으면 채보가 자동 생성돼요': ['音楽ファイルをウィンドウにドロップすると譜面が自動で作られます', 'Drop a music file onto the window to auto-generate a chart'],
    '채보 녹화': ['譜面を録画', 'Record chart'],
    '자동 채보로 되돌리기': ['自動譜面に戻す', 'Back to auto chart'],
    '곡 설정': ['曲の設定', 'Song settings'],
    '삭제': ['削除', 'Delete'],
    '스크롤 속도': ['スクロール速度', 'Scroll speed'],
    '오프셋': ['オフセット', 'Offset'],
    '노트가 소리보다 빠르게 느껴지면 + 로, 늦게 느껴지면 - 로': ['ノーツが音より早く感じたら＋、遅く感じたら−に', 'If notes feel early, go +; if late, go −'],
    '음악 볼륨': ['音楽の音量', 'Music volume'],
    '타격음 볼륨': ['打撃音の音量', 'Hit sound volume'],
    '레인 불투명도': ['レーンの不透明度', 'Lane opacity'],
    '콤보 · 판정 불투명도': ['コンボ・判定の不透明度', 'Combo / judgment opacity'],
    '콤보 숫자와 판정 글자의 진하기. 낮추면 노트가 더 잘 보여요': ['コンボ数と判定文字の濃さ。下げるとノーツが見やすくなります', 'How solid the combo count and judgment text are. Lower it to see the notes better.'],
    '노트가 내려오는 가운데 판의 진하기. 낮추면 뒤의 뮤직비디오가 더 잘 보여요': ['ノーツが流れる中央の板の濃さ。下げると後ろのMVがよく見えます', 'How solid the note field is. Lower it to see more of the music video behind.'],
    '곡 검색 · 제목, 한국어 발음도 OK': ['曲名・読み方で検索', 'Search by title or romaji'],
    '정렬': ['並び替え', 'Sort'],
    '인기순': ['人気順', 'Popular'],
    '제목순': ['タイトル順', 'Title'],
    '레벨 낮은순': ['レベルが低い順', 'Level: low → high'],
    '레벨 높은순': ['レベルが高い順', 'Level: high → low'],
    'BPM 느린순': ['BPMが遅い順', 'BPM: slow → fast'],
    'BPM 빠른순': ['BPMが速い順', 'BPM: fast → slow'],
    '★ 즐겨찾기만': ['★ お気に入りのみ', '★ Favorites'],
    '즐겨찾기': ['お気に入り', 'Favorite'],
    '{n}곡': ['{n}曲', '{n} songs'],
    '조건에 맞는 곡이 없어요': ['条件に合う曲がありません', 'No songs match'],
    '☆ 를 눌러 좋아하는 곡을 즐겨찾기에 담아 보세요': ['☆ を押して好きな曲をお気に入りに追加しよう', 'Tap ☆ to add songs you love to your favorites'],
    '채보 불러오는 중...': ['譜面を読み込み中...', 'Loading chart...'],
    '채보 데이터를 불러오지 못했어요': ['譜面データを読み込めませんでした', "Couldn't load the chart data"],
    '키 모드': ['キーモード', 'Key mode'],
    '7키': ['7キー', '7 keys'],
    '4키': ['4キー', '4 keys'],
    '키 설정': ['キー設定', 'Key settings'],
    '⌨ 키 바꾸기': ['⌨ キーを変更', '⌨ Change keys'],
    '곡 미리듣기': ['曲の試聴', 'Song preview'],
    '타격음': ['打撃音', 'Hit sound'],
    '내 효과음': ['マイ効果音', 'My sounds'],
    '기본 · 안쪽 레인': ['基本 · 内側レーン', 'Main · inner lanes'],
    '없음': ['なし', 'None'],
    '바깥쪽 레인 (선택)': ['外側レーン (任意)', 'Outer lanes (optional)'],
    '지우기': ['消去', 'Clear'],
    '파일은 이 기기 브라우저에만 저장돼요. 바깥쪽을 비워두면 모든 레인에 기본 소리가 나요.': ['ファイルはこの端末のブラウザにだけ保存されます。外側が空なら全レーンで基本の音が鳴ります。', 'Files are saved only in this device\'s browser. If "outer" is empty, the main sound plays on all lanes.'],
    '스킨': ['スキン', 'Skin'],
    '터치 진동': ['タッチ振動', 'Touch vibration'],
    '안드로이드에서만 작동해요': ['Androidのみ対応', 'Android only'],
    '자동 플레이': ['オートプレイ', 'Auto play'],
    '영상은 유튜브 공식 채널에서 재생돼요 ·': ['動画はYouTube公式チャンネルから再生されます ·', 'Videos play from the official YouTube channel ·'],
    '저작권 및 이용 안내': ['著作権・ご利用について', 'Copyright & usage notice'],
    '곡 선택': ['曲選択', 'Song select'],
    '난이도': ['難易度', 'Difficulty'],
    '시작': ['スタート', 'Start'],
    '게임 중': ['プレイ中', 'In game'],
    '속도 조절': ['速度調整', 'Speed'],
    '계속하기': ['続ける', 'Resume'],
    '● 여기까지 녹화 저장': ['● ここまで録画を保存', '● Save recording so far'],
    '다시하기': ['リトライ', 'Retry'],
    '곡 선택으로': ['曲選択へ', 'To song select'],
    '불러오는 중...': ['読み込み中...', 'Loading...'],
    '여기에 놓으면 곡이 추가돼요': ['ここにドロップすると曲が追加されます', 'Drop here to add the song'],
    '확인': ['OK', 'OK'],
    '최근 패치 {d}': ['最新アップデート {d}', 'Last update {d}'],
    '{d} 패치': ['{d} アップデート', 'Update · {d}'],
    '닫기': ['閉じる', 'Close'],
    '기본값으로': ['初期設定に戻す', 'Reset to default'],
    '완료': ['完了', 'Done'],

    /* ---------- 유튜브 곡 추가 창 ---------- */
    '유튜브 곡 추가': ['YouTubeの曲を追加', 'Add a YouTube song'],
    '유튜브 곡 설정': ['YouTube曲の設定', 'YouTube song settings'],
    '공식 채널 영상 주소를 붙여넣으세요. 노래 파일은 저장하지 않고 유튜브 플레이어로만 재생해요.': ['公式チャンネルの動画URLを貼り付けてください。音楽ファイルは保存せず、YouTubeプレイヤーで再生するだけです。', 'Paste an official channel video URL. No music file is saved — it only plays through the YouTube player.'],
    '불러오기': ['読み込む', 'Load'],
    '영상 미리보기': ['動画プレビュー', 'Video preview'],
    '처음으로': ['最初へ', 'To start'],
    '-5초': ['-5秒', '-5s'],
    '+5초': ['+5秒', '+5s'],
    '▶ 재생': ['▶ 再生', '▶ Play'],
    '⏸ 정지': ['⏸ 停止', '⏸ Pause'],
    '제목': ['タイトル', 'Title'],
    '아티스트': ['アーティスト', 'Artist'],
    '첫 박 (초)': ['最初の拍 (秒)', 'First beat (s)'],
    'BPM 고정': ['BPM固定', 'Lock BPM'],
    '켜두면 탭은 첫 박 위치만 계산해요 (BPM을 이미 알 때)': ['オンにするとタップは最初の拍の位置だけ計算します (BPMが分かっているとき)', 'When on, taps only find the first beat (use when you already know the BPM)'],
    '자동 맞추기': ['自動で合わせる', 'Auto-sync'],
    '영상 소리를 듣고 BPM · 첫 박을 찾아요': ['動画の音を聴いてBPMと最初の拍を探します', 'Listens to the video to find the BPM and first beat'],
    '공유 창이 뜨면 <b>이 탭</b>과 <b>탭 오디오 공유</b>를 골라 주세요. 30~60초 정도 들어요. 소리는 저장하지 않아요.': ['共有画面が出たら<b>このタブ</b>と<b>タブの音声を共有</b>を選んでください。30〜60秒ほど聴きます。音声は保存しません。', 'When the share dialog opens, choose <b>this tab</b> and <b>share tab audio</b>. It listens for 30–60 s. Nothing is recorded.'],
    '탭!': ['タップ!', 'Tap!'],
    '탭 0회': ['タップ 0回', 'Taps: 0'],
    '영상을 재생하고 <b>노래가 시작되는 첫 박부터</b> 박자에 맞춰 <kbd>T</kbd> 를 8번 이상 누르면 BPM과 첫 박이 자동으로 채워져요.': ['動画を再生して、<b>曲が始まる最初の拍から</b>リズムに合わせて<kbd>T</kbd>を8回以上押すと、BPMと最初の拍が自動で入ります。', 'Play the video and press <kbd>T</kbd> on the beat 8+ times <b>from the first beat of the song</b> — BPM and first beat fill in automatically.'],
    '탭 다시': ['タップやり直し', 'Reset taps'],
    '지금 위치를 첫 박으로': ['今の位置を最初の拍に', 'Set first beat here'],
    '◀ 1박': ['◀ 1拍', '◀ 1 beat'],
    '1박 ▶': ['1拍 ▶', '1 beat ▶'],
    '메트로놈': ['メトロノーム', 'Metronome'],
    '메트로놈 <b>OFF</b>': ['メトロノーム <b>OFF</b>', 'Metronome <b>OFF</b>'],
    '메트로놈 <b>ON</b>': ['メトロノーム <b>ON</b>', 'Metronome <b>ON</b>'],
    '저장하고 채보 만들기': ['保存して譜面を作る', 'Save & make chart'],
    '저장하고 채보 다시 만들기': ['保存して譜面を作り直す', 'Save & rebuild chart'],
    '첫 박 맞추기 · {title}': ['最初の拍を合わせる · {title}', 'Set first beat · {title}'],
    '지금은 파일로 직접 열려 있어서 유튜브가 재생되지 않아요. 폴더의 start.bat 으로 실행해 주세요.': ['ファイルを直接開いているためYouTubeが再生できません。フォルダの start.bat から起動してください。', 'This page was opened as a file, so YouTube can\'t play. Launch it with start.bat in the folder.'],
    '유튜브 영상 주소를 확인해 주세요 (예: https://www.youtube.com/watch?v=...)': ['YouTubeの動画URLを確認してください (例: https://www.youtube.com/watch?v=...)', 'Check the YouTube URL (e.g. https://www.youtube.com/watch?v=...)'],
    '유튜브는 start.bat 으로 실행했을 때만 재생돼요.': ['YouTubeは start.bat で起動したときだけ再生できます。', 'YouTube only plays when launched with start.bat.'],
    '영상 불러오는 중...': ['動画を読み込み中...', 'Loading video...'],
    '불러왔어요 · 길이 {len}. ▶ 재생 후 탭으로 BPM과 첫 박을 맞추고, 메트로놈으로 확인해 보세요.': ['読み込みました · 長さ {len}。▶ 再生してタップでBPMと最初の拍を合わせ、メトロノームで確認してください。', 'Loaded · length {len}. Press ▶ Play, tap to set BPM and first beat, then check with the metronome.'],
    '영상을 불러오지 못했어요': ['動画を読み込めませんでした', 'Couldn\'t load the video'],
    '먼저 ▶ 재생을 눌러 주세요': ['先に ▶ 再生 を押してください', 'Press ▶ Play first'],
    '탭 {n}회 · 첫 박 {sec}초 · 흔들림 ±{ms}ms': ['タップ {n}回 · 最初の拍 {sec}秒 · ブレ ±{ms}ms', 'Taps {n} · first beat {sec}s · jitter ±{ms}ms'],
    '탭 {n}회 (4번 이상 눌러주세요)': ['タップ {n}回 (4回以上押してください)', 'Taps {n} (tap 4+ times)'],
    '탭 {n}회 · BPM {bpm} · 흔들림 ±{ms}ms': ['タップ {n}回 · BPM {bpm} · ブレ ±{ms}ms', 'Taps {n} · BPM {bpm} · jitter ±{ms}ms'],
    '탭 {n}회': ['タップ {n}回', 'Taps {n}'],
    '먼저 영상을 불러와 주세요': ['先に動画を読み込んでください', 'Load a video first'],
    'BPM을 40~300 사이로 입력해 주세요. 모르면 탭으로 맞출 수 있어요': ['BPMを40〜300で入力してください。分からなければタップで合わせられます', 'Enter a BPM between 40 and 300. If unsure, use taps'],
    '첫 박 위치(초)를 입력해 주세요': ['最初の拍の位置(秒)を入力してください', 'Enter the first beat position (seconds)'],
    '"{title}" 설정을 저장했어요': ['「{title}」の設定を保存しました', 'Saved settings for "{title}"'],
    '"{title}" 추가 완료! 채보를 자동으로 만들었어요': ['「{title}」を追加しました！譜面を自動で作りました', 'Added "{title}"! A chart was generated'],
    '보정 중...': ['補正中...', 'Calibrating...'],
    '그만 듣고 분석': ['分析する', 'Analyze now'],
    '듣는 중 {s}초': ['聴いています {s}秒', 'Listening {s}s'],
    '영상 소리를 듣는 중이에요... {s}초 / 최대 70초 (20초가 지나면 버튼을 눌러 바로 분석할 수 있어요)': ['動画の音を聴いています... {s}秒 / 最大70秒 (20秒を過ぎたらボタンですぐ分析できます)', 'Listening to the video... {s}s / max 70s (after 20s you can press the button to analyze)'],
    '보정 중이에요. 짧은 "틱" 소리가 3번 나요...': ['補正中です。短い「チッ」という音が3回鳴ります...', 'Calibrating. You\'ll hear 3 short ticks...'],
    '분석 중...': ['分析中...', 'Analyzing...'],
    '박자를 분석하는 중이에요...': ['リズムを分析しています...', 'Analyzing the beat...'],
    '찾았어요! BPM {bpm} · 첫 박 {sec}초 · 박자 일치도 {pct}%': ['見つかりました！BPM {bpm} · 最初の拍 {sec}秒 · 一致度 {pct}%', 'Found it! BPM {bpm} · first beat {sec}s · beat match {pct}%'],
    ' (보정 틱을 못 찾아서 정확도가 조금 낮을 수 있어요)': [' (補正音が見つからず精度が少し低いかもしれません)', ' (calibration ticks not found, accuracy may be lower)'],
    '메트로놈과 같이 재생해 줄게요. 맞으면 저장하세요.': ['メトロノームと一緒に再生します。合っていたら保存してください。', 'Playing with the metronome. Save if it matches.'],
    '일치도가 낮아요. 메트로놈으로 들어보고 어긋나면 탭으로 다시 맞춰 주세요.': ['一致度が低いです。メトロノームで確認し、ずれていたらタップで合わせ直してください。', 'Low match. Check with the metronome and re-tap if it\'s off.'],
    '자동 맞추기에 실패했어요': ['自動調整に失敗しました', 'Auto-sync failed'],
    'BPM을 먼저 정해 주세요': ['先にBPMを決めてください', 'Set the BPM first'],

    /* ---------- 곡 상세 · 목록 ---------- */
    '첫 박 설정': ['最初の拍を設定', 'Set first beat'],
    '내 채보': ['マイ譜面', 'My chart'],
    '{count} notes · 롱노트 {holds}': ['{count} notes · ロング {holds}', '{count} notes · holds {holds}'],
    '생성 중...': ['生成中...', 'Generating...'],
    '첫 박 맞추기': ['最初の拍を合わせる', 'Set first beat'],
    'MGA · 실측 채보': ['MGA · 実測譜面', 'MGA · measured chart'],
    '첫 박 위치를 한 번 맞추면 채보가 만들어져요': ['最初の拍を一度合わせると譜面が作られます', 'Set the first beat once to build the chart'],
    'RHYTHM MASTA · 내장 데모': ['RHYTHM MASTA · 内蔵デモ', 'RHYTHM MASTA · built-in demo'],
    '데모 생성 실패': ['デモの生成に失敗', 'Demo failed to build'],
    '로컬 파일': ['ローカルファイル', 'Local file'],
    '제목 없음': ['タイトルなし', 'Untitled'],

    /* ---------- 알림 ---------- */
    '4키 모드 : D F J K': ['4キーモード : D F J K', '4-key mode: D F J K'],
    '7키 모드 : A S D 스페이스 L ; \'': ['7キーモード : A S D スペース L ; \'', '7-key mode: A S D Space L ; \''],
    '효과음 파일은 5MB 이하로 골라 주세요': ['効果音ファイルは5MB以下にしてください', 'Choose a sound file under 5 MB'],
    '3초보다 긴 소리예요. 짧은 효과음이 더 잘 맞아요': ['3秒より長い音です。短い効果音のほうが合います', 'That\'s over 3 s. Short sounds work better'],
    '기본 효과음을 바꿨어요': ['基本の効果音を変更しました', 'Main sound changed'],
    '바깥쪽 효과음을 바꿨어요': ['外側の効果音を変更しました', 'Outer sound changed'],
    '이 파일은 소리로 읽을 수 없어요': ['このファイルは音声として読めません', 'This file can\'t be read as audio'],
    '내 효과음을 지웠어요': ['マイ効果音を消しました', 'My sounds cleared'],
    '가운데': ['中央', 'Center'],
    '{n}번': ['{n}番', 'Lane {n}'],
    '{n}번 레인에 쓸 키를 누르세요 (Esc 취소)': ['{n}番レーンに使うキーを押してください (Escで取消)', 'Press a key for lane {n} (Esc to cancel)'],
    '키 설정 · {mode}': ['キー設定 · {mode}', 'Key settings · {mode}'],
    '바꾸고 싶은 레인을 누른 다음, 원하는 키를 누르세요': ['変えたいレーンを押してから、使いたいキーを押してください', 'Click a lane, then press the key you want'],
    '취소했어요': ['キャンセルしました', 'Cancelled'],
    '그 키는 쓸 수 없어요. 다른 키를 눌러 주세요': ['そのキーは使えません。別のキーを押してください', 'That key can\'t be used. Try another'],
    '{n}번 레인 → {key}': ['{n}番レーン → {key}', 'Lane {n} → {key}'],
    '기본 키로 되돌렸어요': ['初期のキーに戻しました', 'Keys reset to default'],
    '앨범 오마쥬': ['アルバムオマージュ', 'Album homage'],
    '앨범 커버의 색감과 분위기를 빌려온 스킨': ['アルバムジャケットの色と雰囲気を借りたスキン', 'Skins inspired by the colors and mood of album covers'],
    '스킨 : {name}': ['スキン : {name}', 'Skin: {name}'],
    '노트가 너무 적어서 저장하지 않았어요': ['ノーツが少なすぎるので保存しませんでした', 'Too few notes — not saved'],
    '{d} 채보를 녹화한 내용으로 저장했어요 (노트 {n}개)': ['{d} の譜面を録画内容で保存しました (ノーツ {n}個)', 'Saved {d} chart from your recording ({n} notes)'],
    '음악 파일만 추가할 수 있어요': ['音楽ファイルだけ追加できます', 'Only music files can be added'],
    '"{name}" 불러오는 중...': ['「{name}」を読み込み中...', 'Loading "{name}"...'],
    '"{name}" 비트 분석 중...': ['「{name}」のビートを分析中...', 'Analyzing beats of "{name}"...'],
    '"{name}" 추가 완료!': ['「{name}」を追加しました！', 'Added "{name}"!'],
    '"{name}"을(를) 읽을 수 없어요': ['「{name}」を読み込めません', 'Can\'t read "{name}"'],
    '이 난이도는 채보가 없어요': ['この難易度には譜面がありません', 'No chart for this difficulty'],
    '유튜브 곡은 start.bat 으로 실행해야 재생돼요': ['YouTubeの曲は start.bat で起動しないと再生できません', 'YouTube songs need start.bat to play'],
    '영상 준비 중...': ['動画を準備中...', 'Preparing video...'],
    '● {d} 채보 녹화 시작! 박자에 맞춰 쳐 보세요': ['● {d} 譜面の録画開始！リズムに合わせて叩いてみてください', '● Recording {d} chart! Tap along to the beat'],
    'FAST {f}  ·  SLOW {s}  ·  평균 판정 오차 {avg}ms': ['FAST {f}  ·  SLOW {s}  ·  平均判定誤差 {avg}ms', 'FAST {f}  ·  SLOW {s}  ·  avg. timing error {avg}ms'],
    '입력이 평균 {ms}ms 늦어요 → 추천 오프셋': ['入力が平均 {ms}ms 遅れています → おすすめオフセット', 'Your input is {ms}ms late on average → suggested offset'],
    '입력이 평균 {ms}ms 빨라요 → 추천 오프셋': ['入力が平均 {ms}ms 早いです → おすすめオフセット', 'Your input is {ms}ms early on average → suggested offset'],
    '적용': ['適用', 'Apply'],
    '오프셋을 {v}ms 로 적용했어요': ['オフセットを {v}ms にしました', 'Offset set to {v}ms'],
    '스크롤 속도 x{v}': ['スクロール速度 x{v}', 'Scroll speed x{v}'],
    '{d} 녹화 채보를 지우고 자동 채보로 되돌릴까요?': ['{d} の録画譜面を消して自動譜面に戻しますか？', 'Delete the recorded {d} chart and go back to the auto chart?'],
    '자동 채보로 되돌렸어요': ['自動譜面に戻しました', 'Back to the auto chart'],
    '"{title}" 을(를) 목록에서 삭제할까요?\n녹화한 채보와 기록도 함께 지워져요.': ['「{title}」をリストから削除しますか？\n録画した譜面と記録も消えます。', 'Remove "{title}" from the list?\nRecorded charts and records will be deleted too.'],
    '삭제했어요': ['削除しました', 'Deleted'],

    /* ---------- 게임 화면 ---------- */
    '박자에 맞춰 키를 쳐서 채보를 만들어요 · 길게 누르면 롱노트 · Esc → 저장/취소': ['リズムに合わせて叩いて譜面を作ります · 長押しでロングノーツ · Esc → 保存/取消', 'Tap along to make a chart · hold for long notes · Esc → save/cancel'],

    /* ---------- 유튜브 · 자동 맞추기 오류 ---------- */
    '영상 주소가 올바르지 않아요': ['動画のURLが正しくありません', 'Invalid video URL'],
    '이 브라우저에서 영상을 재생할 수 없어요': ['このブラウザでは動画を再生できません', 'This browser can\'t play the video'],
    '영상을 찾을 수 없어요 (삭제되었거나 비공개)': ['動画が見つかりません (削除または非公開)', 'Video not found (deleted or private)'],
    '이 영상은 외부 재생이 막혀 있어요 (채널 설정). 다른 영상을 골라주세요': ['この動画は外部再生が禁止されています (チャンネル設定)。別の動画を選んでください', 'Embedding is disabled for this video (channel setting). Pick another video'],
    '유튜브가 재생을 거부했어요. start.bat 로 실행했는지 확인해 주세요': ['YouTubeが再生を拒否しました。start.bat で起動したか確認してください', 'YouTube refused playback. Make sure you launched with start.bat'],
    '영상 재생 오류 (코드 {c})': ['動画再生エラー (コード {c})', 'Video playback error (code {c})'],
    '유튜브에 연결할 수 없어요. 인터넷 연결을 확인해 주세요': ['YouTubeに接続できません。インターネット接続を確認してください', 'Can\'t reach YouTube. Check your internet connection'],
    '유튜브 플레이어를 불러오지 못했어요 (시간 초과)': ['YouTubeプレイヤーを読み込めませんでした (タイムアウト)', 'YouTube player failed to load (timeout)'],
    '유튜브 플레이어를 준비하지 못했어요': ['YouTubeプレイヤーを準備できませんでした', 'YouTube player couldn\'t start'],
    '영상을 불러오지 못했어요 (시간 초과)': ['動画を読み込めませんでした (タイムアウト)', 'Couldn\'t load the video (timeout)'],
    '영상 버퍼링 중...': ['動画をバッファ中...', 'Buffering video...'],
    '유튜브 광고가 나오는 중일 수 있어요. 끝나면 자동으로 시작해요': ['YouTubeの広告が流れているかもしれません。終わると自動で始まります', 'A YouTube ad may be playing. The game starts automatically when it ends'],
    '유튜브 프리미엄이 아니면 곡 앞에 광고가 나올 수 있어요. 건너뛰기 버튼이 보이면 눌러도 돼요': ['YouTube Premiumでない場合、曲の前に広告が流れることがあります。スキップボタンが出たら押してもOKです', 'Without YouTube Premium, an ad may play before the song. You can press Skip when it appears'],
    '취소': ['キャンセル', 'Cancel'],
    '결과 공유': ['結果をシェア', 'Share result'],
    'X에 공유': ['Xでシェア', 'Share on X'],
    '공유하기': ['シェアする', 'Share'],
    '이미지 저장': ['画像を保存', 'Save image'],
    '링크 복사': ['リンクをコピー', 'Copy link'],
    '닫기': ['閉じる', 'Close'],
    '이미지를 만드는 중...': ['画像を作成中...', 'Making image...'],
    '이미지를 만들지 못했어요': ['画像を作れませんでした', 'Couldn\'t make the image'],
    '비공식 팬메이드': ['非公式ファンメイド', 'Unofficial fan-made'],
    'X · LINE 으로 보낼 때 이미지는 저장한 뒤 직접 첨부해 주세요': ['X・LINEに送るときは画像を保存して添付してください', 'For X / LINE, save the image and attach it yourself'],
    '「공유하기」로 카카오톡 · LINE · 인스타 등에 이미지째 보낼 수 있어요': ['「シェアする」でLINE・インスタなどに画像ごと送れます', 'Use "Share" to send the image to LINE, Instagram, KakaoTalk and more'],
    '공유 글과 링크를 복사했어요': ['シェア文とリンクをコピーしました', 'Copied the text and link'],
    '🍏 RHYTHM MASTA 에서 「{title}」 {diff} LV.{lv} 플레이!': ['🍏 RHYTHM MASTAで「{title}」{diff} LV.{lv}をプレイ！', '🍏 Played "{title}" {diff} LV.{lv} on RHYTHM MASTA!'],
    '오늘': ['今日', 'Today'],
    '누적': ['累計', 'Total'],
    '방문자 수': ['訪問者数', 'Visitors'],
    '방문자 수는 GoatCounter 로 세요': ['訪問者数はGoatCounterで数えています', 'Visitor counts use GoatCounter'],
    '화면 위의 오늘 · 누적 방문자 수는 GoatCounter 로 세고 있어요. 쿠키는 쓰지 않아요.': ['画面上部の今日・累計の訪問者数はGoatCounterで数えています。Cookieは使いません。', "The today / total visitor counts at the top are counted with GoatCounter. No cookies are used."],
    '영상 준비 중... (광고가 나오면 끝날 때까지 기다려 주세요)': ['動画を準備中... (広告が出たら終わるまでお待ちください)', 'Preparing video... (if an ad plays, please wait for it to end)'],
    '이 브라우저는 탭 소리 공유를 지원하지 않아요. 크롬이나 엣지를 써 주세요': ['このブラウザはタブ音声の共有に対応していません。ChromeかEdgeを使ってください', 'This browser can\'t share tab audio. Use Chrome or Edge'],
    '탭 공유가 취소됐어요': ['タブの共有がキャンセルされました', 'Tab sharing was cancelled'],
    '소리가 공유되지 않았어요. 공유 창에서 "탭 오디오도 공유"를 켜고 이 탭을 골라 주세요': ['音声が共有されませんでした。共有画面で「タブの音声も共有」をオンにしてこのタブを選んでください', 'No audio was shared. Turn on "share tab audio" and pick this tab'],
    '너무 짧게 들었어요. 조금 더 길게 재생해 주세요': ['聴いた時間が短すぎます。もう少し長く再生してください', 'Listened too briefly. Play a little longer'],
    '소리가 들리지 않았어요. 영상 소리가 켜져 있는지 (음악 볼륨) 확인해 주세요': ['音が聞こえませんでした。動画の音 (音楽の音量) がオンか確認してください', 'No sound heard. Check that the video sound (music volume) is on'],
    '영상 재생 시간을 읽지 못했어요': ['動画の再生時間を読み取れませんでした', 'Couldn\'t read the video time'],
    '박자를 찾을 만큼 소리가 충분하지 않았어요': ['リズムを見つけるのに十分な音がありませんでした', 'Not enough sound to find the beat'],
    'BPM을 찾지 못했어요': ['BPMが見つかりませんでした', 'Couldn\'t find the BPM'],
    '노래가 시작되는 지점을 찾지 못했어요. 더 길게 들어봐 주세요': ['曲が始まる位置が見つかりませんでした。もう少し長く聴いてください', 'Couldn\'t find where the song starts. Listen longer'],
    '곡이 너무 짧아요': ['曲が短すぎます', 'The song is too short'],
    '타격 지점을 찾지 못했어요': ['打点が見つかりませんでした', 'No hit points found'],

    /* ---------- 타격음 · 스킨 이름 ---------- */
    '스네어': ['スネア', 'Snare'],
    '킥 드럼': ['キック', 'Kick drum'],
    '탐 드럼': ['タム', 'Tom'],
    '하이햇': ['ハイハット', 'Hi-hat'],
    '카우벨': ['カウベル', 'Cowbell'],
    '타블라 (게/나)': ['タブラ (ゲ/ナ)', 'Tabla (ghe/na)'],
    '내 효과음 파일': ['マイ効果音ファイル', 'My sound file'],
    '선셋 사바나': ['サンセット・サバンナ', 'Sunset Savanna'],
    'TWELVE 오마쥬 · 노을 핑크와 삼각 모자이크': ['TWELVEオマージュ · 夕焼けピンクと三角モザイク', 'TWELVE homage · sunset pink & triangle mosaic'],
    '그린 엠블럼': ['グリーン・エンブレム', 'Green Emblem'],
    'Mrs. GREEN APPLE(2017) 오마쥬 · 초록과 크림 윤곽선': ['Mrs. GREEN APPLE(2017)オマージュ · 緑とクリームの輪郭線', 'Mrs. GREEN APPLE (2017) homage · green & cream outlines'],
    '마키 시어터': ['マーキー・シアター', 'Marquee Theater'],
    'ENSEMBLE 오마쥬 · 극장 간판과 금빛 전구': ['ENSEMBLEオマージュ · 劇場の看板と金色の電球', 'ENSEMBLE homage · theater marquee & golden bulbs'],
    '레인보우 오차드': ['レインボー・オーチャード', 'Rainbow Orchard'],
    'Attitude 오마쥬 · 열매 숲과 무지개 연기': ['Attitudeオマージュ · 実のなる森と虹色の煙', 'Attitude homage · fruit forest & rainbow smoke'],
    '페인트 타워': ['ペイント・タワー', 'Paint Tower'],
    'ANTENNA 오마쥬 · 물감 스플래시와 무지개 줄무늬': ['ANTENNAオマージュ · 絵の具のしぶきと虹のストライプ', 'ANTENNA homage · paint splashes & rainbow stripes'],
    '하모니 블룸': ['ハーモニー・ブルーム', 'Harmony Bloom'],
    '10 오마쥬 · 꽃 콜라주와 픽셀 모자이크': ['10オマージュ · 花のコラージュとピクセルモザイク', '10 homage · flower collage & pixel mosaic'],
    '애플 스킨': ['アップル・スキン', 'Apple Skin'],
    'POPS 오마쥬 · 청사과 껍질 질감과 광택': ['POPSオマージュ · 青りんごの皮の質感とつや', 'POPS homage · green apple skin texture & shine'],

    /* ---------- 저작권 및 이용 안내 ---------- */
    '비공식 팬메이드 · 비영리': ['非公式ファンメイド · 非営利', 'Unofficial fan-made · Non-profit'],
    'Mrs. GREEN APPLE 팬이 개인적으로 만든 비공식 게임이에요. Mrs. GREEN APPLE 및 소속사·레이블과는 관계가 없고, 광고·후원 등 어떤 수익도 받지 않아요.': ['Mrs. GREEN APPLEのファンが個人的に作った非公式ゲームです。Mrs. GREEN APPLEおよび所属事務所・レーベルとは関係がなく、広告や支援などの収益も一切受け取っていません。', 'An unofficial game made personally by a Mrs. GREEN APPLE fan. It is not affiliated with Mrs. GREEN APPLE, their agency or label, and earns no revenue of any kind (no ads, no donations).'],
    '노래·영상 파일은 들어 있지 않아요': ['曲・動画ファイルは含まれていません', 'No music or video files are included'],
    '게임에는 노래나 영상 파일이 포함되어 있지 않아요. 곡은 유튜브 공식 플레이어(IFrame API)로 공식 채널에 올라온 영상을 재생해요. 조회·재생은 모두 유튜브를 통해 이루어져요.': ['ゲームには曲や動画のファイルは含まれていません。曲はYouTube公式プレイヤー(IFrame API)で公式チャンネルの動画を再生します。視聴・再生はすべてYouTubeを通して行われます。', 'The game contains no music or video files. Songs play official-channel videos through the official YouTube player (IFrame API). All viewing and playback happen on YouTube.'],
    '채보는 노트 위치 데이터예요': ['譜面はノーツの位置データです', 'Charts are note-timing data'],
    '샘플 곡 채보에는 곡의 박자와 소리 위치를 분석해 만든 노트 타이밍 데이터만 들어 있어요. 음원 자체는 들어 있지 않아요.': ['サンプル曲の譜面には、曲のリズムと音の位置を分析して作ったノーツのタイミングデータだけが入っています。音源そのものは含まれていません。', 'Sample-song charts contain only note-timing data made by analyzing each song\'s beat and sound positions. No audio is included.'],
    '스킨은 색감만 빌린 오마쥬예요': ['スキンは色合いだけ借りたオマージュです', 'Skins are color-only homages'],
    '앨범 오마쥬 스킨은 커버의 색감과 분위기만 참고해서 새로 그렸어요. 커버 그림, 로고, 앨범 타이틀은 쓰지 않았어요.': ['アルバムオマージュのスキンは、ジャケットの色合いと雰囲気だけを参考に新しく描きました。ジャケットの絵、ロゴ、アルバムタイトルは使っていません。', 'Album-homage skins were newly drawn, referencing only the colors and mood of the covers. No cover art, logos or album titles are used.'],
    '효과음은 퍼블릭 도메인이에요': ['効果音はパブリックドメインです', 'Sound effects are public domain'],
    '타격음은 Sonic Pi 기본 샘플(CC0 퍼블릭 도메인) 녹음이에요. 출처는 저장소의 sounds/CREDITS.md 에 있어요.': ['打撃音はSonic Piの標準サンプル(CC0 パブリックドメイン)の録音です。出典はリポジトリの sounds/CREDITS.md にあります。', 'Hit sounds are recordings from Sonic Pi\'s bundled samples (CC0 public domain). Sources are listed in sounds/CREDITS.md in the repository.'],
    '권리는 원 권리자에게 있어요': ['権利は原権利者にあります', 'All rights belong to their owners'],
    '곡, 뮤직비디오, 아티스트명과 관련된 모든 권리는 각 권리자에게 있어요.': ['楽曲、ミュージックビデオ、アーティスト名に関するすべての権利は各権利者に帰属します。', 'All rights to the songs, music videos and artist name belong to their respective owners.'],
    '요청하시면 바로 고칠게요': ['ご要望があればすぐに対応します', 'We\'ll fix things on request'],
    '권리자께서 수정이나 삭제를 원하시면 GitHub 저장소(github.com/Seongyoru/rhythm-masta)의 Issues 로 알려주세요. 확인하는 대로 바로 수정하거나 내릴게요.': ['権利者の方で修正や削除をご希望の場合は、GitHubリポジトリ(github.com/Seongyoru/rhythm-masta)のIssuesでお知らせください。確認次第すぐに修正または公開を停止します。', 'If you are a rights holder and want something changed or removed, please open an Issue on the GitHub repository (github.com/Seongyoru/rhythm-masta). It will be fixed or taken down as soon as it is seen.'],
  };
  const IDX = { ja: 0, en: 1 };
  let lang = 'ko';
  function T(s, vars) {
    let r = s;
    if (lang !== 'ko' && DICT[s]) r = DICT[s][IDX[lang]];
    if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return r;
  }

  /* 정적 HTML 번역 : 처음 원문을 기억해 두고 언어가 바뀔 때마다 다시 그림 */
  const norm = (x) => x.replace(/\s+/g, ' ').trim();
  let textNodes = null, attrEls = null, htmlEls = null;
  function collect() {
    htmlEls = [...document.querySelectorAll('[data-i18n-html]')].map((el) => ({ el, key: norm(el.innerHTML) }));
    const skip = new Set(htmlEls.map((h) => h.el));
    textNodes = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        for (let p = n.parentElement; p; p = p.parentElement) {
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || skip.has(p)) return NodeFilter.FILTER_REJECT;
        }
        return /[가-힣]/.test(n.nodeValue) && DICT[norm(n.nodeValue)] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const v = n.nodeValue, key = norm(v);
      textNodes.push({ n, key, lead: v.match(/^\s*/)[0], tail: v.match(/\s*$/)[0] });
    }
    attrEls = [];
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute(a);
        if (v && DICT[norm(v)]) attrEls.push({ el, a, key: norm(v) });
      }
    });
  }
  function applyStatic() {
    if (!textNodes) collect();
    for (const t of textNodes) t.n.nodeValue = t.lead + T(t.key) + t.tail;
    for (const h of htmlEls) h.el.innerHTML = T(h.key);
    for (const a of attrEls) a.el.setAttribute(a.a, T(a.key));
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;
  }
  function setLang(l) {
    lang = ['ko', 'ja', 'en'].includes(l) ? l : 'ko';
    applyStatic();
  }
  function detect() {
    const n = (navigator.language || 'ko').toLowerCase();
    return n.startsWith('ja') ? 'ja' : n.startsWith('ko') ? 'ko' : 'en';
  }
  return { T, setLang, detect, get lang() { return lang; } };
})();
const T = I18N.T;

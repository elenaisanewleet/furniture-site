# Установка на VPS

VPS — это не «хостинг, куда заливают файлы», а пустая машина с Linux.
Возни больше, чем с Vercel, но для этого сайта форма подходит лучше
остальных: сайт, приём заявок и Telegram-мост живут вместе, в одном
месте, под одним доменом.

Всё, что ниже, делается один раз. Дальше выкладка — одна команда.

---

## Сначала проверить: где стоит сервер

**Это важнее всех настроек.** Заявка с сайта — это имя, телефон и
фотографии чужой квартиры. По 152-ФЗ персональные данные российских
граждан должны храниться на серверах **в России**.

Если у выбранного тарифа дата-центр в Нидерландах, Германии или где-то
ещё — сайт там держать можно (в статике персональных данных нет), а
**приём заявок нельзя**. Тогда сайт остаётся на VPS, а обработчик
переезжает на российскую площадку.

Локацию видно при заказе тарифа или в поддержке. Спросить стоит до
настройки, а не после.

---

## 1. Подготовить машину

Под `root`, один раз:

```bash
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx rsync ufw

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Отдельный пользователь: сервис заявок не должен ходить под root
useradd --system --create-home --home-dir /srv/masterskaya masterskaya
mkdir -p /srv/masterskaya/data /var/www/masterskaya
chown -R masterskaya:masterskaya /srv/masterskaya

# Наружу только ssh и веб
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

Порт 8787 наружу открывать **не нужно**: обработчик слушает только
localhost, а до людей его доводит nginx.

## 2. Направить домен

У регистратора домена — две A-записи на IP сервера:

| Тип | Имя | Значение |
|---|---|---|
| A | `@` | IP вашего VPS |
| A | `www` | IP вашего VPS |

Обновление разъезжается по интернету до нескольких часов. Проверить:
`dig +short ваш-домен.ru` — должен ответить ваш IP.

## 3. Настроить nginx и сертификат

```bash
# Конфиг из репозитория, заменив ДОМЕН на настоящий
sed 's/ДОМЕН/ваш-домен.ru/g' deploy/nginx.conf \
  > /etc/nginx/sites-available/masterskaya
ln -s /etc/nginx/sites-available/masterskaya /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

mkdir -p /var/www/certbot
certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru

nginx -t && systemctl reload nginx
```

`certbot` сам продлевает сертификат, следить за этим не нужно.

## 4. Положить обработчик заявок

```bash
# Код серверной части — без зависимостей, npm install не нужен
rsync -av server/ root@ваш-домен.ru:/srv/masterskaya/server/
```

Дальше на сервере создать `/srv/masterskaya/.env`:

```ini
PORT=8787
DATA_DIR=/srv/masterskaya/data
ALLOW_ORIGIN=https://ваш-домен.ru
REDIRECT_URL=https://ваш-домен.ru/spasibo/

# Появятся, когда будет бот
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Токен бота — это доступ к переписке с клиентами, поэтому файл закрываем:

```bash
chown masterskaya:masterskaya /srv/masterskaya/.env
chmod 600 /srv/masterskaya/.env
```

Включить сервисы:

```bash
cp deploy/masterskaya-lead.service /etc/systemd/system/
cp deploy/masterskaya-bot.service /etc/systemd/system/   # когда будет бот
systemctl daemon-reload
systemctl enable --now masterskaya-lead

curl https://ваш-домен.ru/api/health     # должно ответить {"ok":true}
```

## 5. Выложить сайт

С рабочего компьютера:

```bash
SITE_URL=https://ваш-домен.ru \
DEPLOY_HOST=root@ваш-домен.ru \
DEPLOY_PATH=/var/www/masterskaya \
./scripts/deploy.sh
```

И последнее — сказать сайту, куда слать заявки. В `.env` рядом с
проектом (**на рабочем компьютере**, не на сервере — переменная
подставляется при сборке):

```ini
PUBLIC_LEAD_ENDPOINT=https://ваш-домен.ru/api/submit
```

После этого пересобрать и выложить ещё раз. Заявки пойдут на тот же
домен, что и сайт, — запрос перестаёт быть межсайтовым, и CORS со всеми
его граблями просто не возникает.

---

## Дальше

Выкладка новой версии — та же одна команда из шага 5.

Что смотреть, если что-то не так:

```bash
systemctl status masterskaya-lead     # живой ли обработчик
journalctl -u masterskaya-lead -f     # что он пишет прямо сейчас
tail -f /var/log/nginx/error.log      # что говорит nginx
ls -la /srv/masterskaya/data/         # дошли ли заявки
```

**Резервные копии.** `leads.jsonl` и папка `uploads/` — единственное на
сервере, что нельзя восстановить пересборкой. Снимок диска у провайдера
это не заменяет: он про машину целиком, а не про конкретные файлы.

```bash
# Простейший вариант — забирать к себе раз в сутки
rsync -az root@ваш-домен.ru:/srv/masterskaya/data/ ./backup/
```

**До запуска формы** заполнить `/privacy/` и `/soglasie/` — сейчас там
шаблоны-рыба. Собирать заявки без опубликованной политики нельзя.

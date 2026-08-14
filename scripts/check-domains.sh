#!/usr/bin/env bash
# Проверка, свободны ли доменные имена в зоне .ru / .рф.
#
# Запускать на машине с открытым интернетом — например, прямо на сервере:
#   bash check-domains.sh
#   bash check-domains.sh мебель-мастер стол-шкаф      # свои варианты
#
# Спрашивает напрямую у реестра (whois.tcinet.ru), а не у сайта-посредника,
# который заодно норовит перехватить понравившееся имя.
#
# «свободен» здесь значит «не зарегистрирован». Имя всё равно может быть
# занято как товарный знак — это отдельная история, и её whois не знает.

set -uo pipefail

WHOIS_SRV="whois.tcinet.ru"
ZONES=("ru" "рф")

CANDIDATES=("$@")
if [ ${#CANDIDATES[@]} -eq 0 ]; then
  # Варианты по смыслу сайта: мастерская, которая чинит и делает мебель.
  # Без дефисов и цифр — такое имя можно продиктовать по телефону.
  CANDIDATES=(
    masterskaya-mebeli
    mebelnayamasterskaya
    stolyarnaya
    svoyamebel
    mebelpofoto
    pokazhitezadachu
    remontmebeli73
    mebelidetali
    dvertsa
    furnitura73
  )
fi

# Реестр .ru отвечает по-русски и в utf-8; без явной проверки на «свободен»
# легко принять ответ об ошибке за отсутствие домена.
check() {
  local domain="$1" out
  out=$(printf '%s\r\n' "$domain" | timeout 10 \
        bash -c "exec 3<>/dev/tcp/${WHOIS_SRV}/43 && cat >&3 && cat <&3" 2>/dev/null) || {
    printf '  %-28s %s\n' "$domain" "не удалось спросить реестр"
    return
  }

  if grep -qi 'No entries found' <<<"$out"; then
    printf '  %-28s \033[32mсвободен\033[0m\n' "$domain"
  elif grep -qi '^state:' <<<"$out"; then
    local till
    till=$(grep -i '^free-date:\|^paid-till:' <<<"$out" | head -1 | cut -d: -f2- | tr -d ' ')
    printf '  %-28s занят%s\n' "$domain" "${till:+, оплачен до $till}"
  else
    printf '  %-28s непонятный ответ\n' "$domain"
  fi
}

command -v timeout >/dev/null || { echo "нужен coreutils (timeout)"; exit 1; }

for zone in "${ZONES[@]}"; do
  echo
  echo "зона .${zone}"
  for name in "${CANDIDATES[@]}"; do
    check "${name}.${zone}"
  done
done

echo
echo "Свободен ≠ хорош. Прежде чем платить, проверьте имя вслух:"
echo "продиктуйте его по телефону человеку, который его не видел."

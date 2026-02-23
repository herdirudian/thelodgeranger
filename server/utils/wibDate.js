const toDate = (value) => {
  return value instanceof Date ? value : new Date(value);
};

const formatWibPrintStamp = (value) => {
  const date = toDate(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return `${day}/${month}/${year}, ${hour}.${minute}.${second}`;
};

const formatWibLongDate = (value) => {
  const date = toDate(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const formatWibLongDateId = (value) => {
  const date = toDate(value);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const formatWibTimeHms = (value) => {
  const date = toDate(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return `${hour}:${minute}:${second}`;
};

const formatWibDate = (value) => {
  const date = toDate(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const formatWibTime = (value) => {
  const date = toDate(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

module.exports = {
  formatWibPrintStamp,
  formatWibLongDate,
  formatWibLongDateId,
  formatWibTimeHms,
  formatWibDate,
  formatWibTime
};


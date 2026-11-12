(() => {
  'use strict';
  const form = document.querySelector('#apply-form');
  const status = document.querySelector('#application-status');
  const submit = form.querySelector('[type="submit"]');
  const portfolioLink = document.querySelector('#applicant-link');
  const portfolioFiles = document.querySelector('#applicant-files');
  const cvFiles = document.querySelector('#applicant-cv');
  const fileSummary = document.querySelector('#file-summary');
  const meetingSlots = document.querySelector('#meeting-slots');
  const meetingSelection = document.querySelector('#meeting-selection');
  const meetingError = document.querySelector('#meeting-error');
  const postedOn = document.querySelector('#opening-date').dateTime;
  const slotOptions = [10, 11, 13, 14, 15, 16, 17, 18, 19, 20].map(hour => {
    const start = String(hour).padStart(2, '0') + ':00';
    const end = String(hour + 1).padStart(2, '0') + ':00';
    return { time: start + '–' + end, start, end };
  });
  const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
  const opening = new Date(postedOn + 'T00:00:00Z');
  const lastDay = new Date(opening); lastDay.setUTCDate(lastDay.getUTCDate() + 13);
  document.querySelector('#meeting-range').textContent = postedOn.replaceAll('-', '.') + ' — ' + lastDay.toISOString().slice(0, 10).replaceAll('-', '.');
  for (let day = 0; day < 14; day++) {
    const date = new Date(opening); date.setUTCDate(date.getUTCDate() + day);
    const iso = date.toISOString().slice(0, 10);
    const row = document.createElement('details'); row.className = 'meeting-day';
    const label = document.createElement('summary'); label.className = 'meeting-date';
    const dateTitle = document.createElement('span'); dateTitle.textContent = dateFormat.format(date);
    const selectionCount = document.createElement('span'); selectionCount.className = 'meeting-count'; selectionCount.textContent = '시간 선택';
    label.append(dateTitle, selectionCount); row.append(label);
    const options = document.createElement('div'); options.className = 'meeting-options';
    for (const slot of slotOptions) {
      const control = document.createElement('label'); control.className = 'meeting-option';
      const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'meeting-slot';
      input.value = iso + ' ' + slot.time + ' (한국 시간)';
      input.dataset.starts = iso + 'T' + slot.start + ':00+09:00';
      input.setAttribute('aria-label', iso + ' ' + slot.time + ' 첫 미팅 1시간');
      const title = document.createElement('span'); title.textContent = slot.start;
      const time = document.createElement('small'); time.textContent = '–' + slot.end;
      control.append(input, title, time); options.append(control);
    }
    row.append(options); meetingSlots.append(row);
  }
  let meetingExpired = false;
  function syncMeeting() {
    const now = Date.now();
    const inputs = [...meetingSlots.querySelectorAll('input')];
    inputs.forEach(input => {
      input.disabled = Date.parse(input.dataset.starts) <= now;
      if (input.disabled) input.checked = false;
      input.setCustomValidity('');
    });
    const selected = inputs.filter(input => input.checked).map(input => input.value);
    const firstAvailable = inputs.find(input => !input.disabled);
    meetingExpired = !firstAvailable;
    if (firstAvailable) firstAvailable.setCustomValidity(selected.length ? '' : '첫 미팅 가능한 시간대를 한 개 이상 선택해 주세요.');
    meetingSelection.value = selected.join('\n');
    meetingSlots.querySelectorAll('.meeting-day').forEach(day => {
      const count = day.querySelectorAll('input:checked').length;
      const unavailable = !day.querySelector('input:not(:disabled)');
      day.querySelector('.meeting-count').textContent = unavailable ? '선택 마감' : count ? count + '개 선택' : '시간 선택';
      day.classList.toggle('is-expired', unavailable);
    });
    meetingError.textContent = meetingExpired ? '이 공고의 미팅 선택 기간이 지났습니다. hello@beerfriend.co로 다음 모집 일정을 문의해 주세요.' : '';
  }
  meetingSlots.addEventListener('change', syncMeeting);
  syncMeeting();
  meetingSlots.querySelector('input:not(:disabled)')?.closest('details').setAttribute('open', '');
  function syncPortfolio() {
    const files = [...portfolioFiles.files];
    const cvs = [...cvFiles.files];
    const bytes = [...files, ...cvs].reduce((sum, file) => sum + file.size, 0);
    portfolioLink.setCustomValidity(portfolioLink.value.trim() || files.length ? '' : '포트폴리오 링크를 입력하거나 파일을 첨부해 주세요.');
    if (portfolioLink.value.trim() && !/^https?:\/\//i.test(portfolioLink.value.trim())) portfolioLink.setCustomValidity('http:// 또는 https://로 시작하는 열람 가능한 링크를 입력해 주세요.');
    portfolioFiles.setCustomValidity(''); cvFiles.setCustomValidity('');
    if (bytes > 10000000) (cvs.length ? cvFiles : portfolioFiles).setCustomValidity('포트폴리오와 CV 첨부 합계는 10 MB까지입니다. 큰 파일은 링크로 보내주세요.');
    fileSummary.textContent = files.length ? files.map(file => file.name).join(', ') + ' · ' + (files.reduce((sum, file) => sum + file.size, 0) / 1000000).toFixed(2) + ' MB' : '';
    document.querySelector('#cv-summary').textContent = cvs.map(file => file.name).join(', ');
  }
  portfolioFiles.addEventListener('change', syncPortfolio); cvFiles.addEventListener('change', syncPortfolio); portfolioLink.addEventListener('input', syncPortfolio);
  syncPortfolio();
  form.addEventListener('formdata', event => {
    // Separate file fields preserve every attachment with the provider's native upload support.
    event.formData.delete('attachment');
    event.formData.delete('cv_attachment');
    [...portfolioFiles.files].forEach((file, index) => event.formData.append('attachment_portfolio_' + (index + 1), file, file.name));
    [...cvFiles.files].forEach((file, index) => event.formData.append('attachment_cv_' + (index + 1), file, file.name));
  });
  const requiredText = [...form.querySelectorAll('input[required]:not([type="checkbox"]), textarea[required]')];
  requiredText.forEach(field => field.addEventListener('input', () => field.setCustomValidity('')));
  document.querySelector('#applicant-education').addEventListener('change', event => {
    const semester = document.querySelector('#applicant-semester');
    if (['졸업', '해당 없음'].includes(event.target.value) && !semester.value.trim()) semester.value = '해당 없음';
  });
  let sending = false;
  form.noValidate = true;
  function formStatus(message, state) { status.textContent = message; status.dataset.state = state; }
  function resetSubmission() {
    syncMeeting(); syncPortfolio();
    sending = false; submit.disabled = meetingExpired; submit.textContent = '지원서 보내기'; form.removeAttribute('aria-busy');
    formStatus('', '');
  }
  addEventListener('pageshow', resetSubmission);
  resetSubmission();
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (sending) return;
    syncMeeting(); syncPortfolio();
    requiredText.forEach(field => field.setCustomValidity(field.value.trim() ? '' : '내용을 입력해 주세요. 해당 사항이 없다면 ‘없음’이라고 적어주세요.'));
    const phone = document.querySelector('#applicant-phone');
    if (phone.value.trim() && phone.value.replace(/\D/g, '').length < 7) phone.setCustomValidity('연락 가능한 전화번호를 입력해 주세요.');
    if (!meetingSelection.value) meetingSlots.querySelector('input:not(:disabled)')?.closest('details').setAttribute('open', '');
    if (meetingExpired || !form.reportValidity()) return;
    form.elements.namedItem('name').value = form.elements.namedItem('name').value.trim();
    form.elements.namedItem('email').value = form.elements.namedItem('email').value.trim();
    form.elements.namedItem('_subject').value = '[BeeRFriend UI/UX 공동창업자 지원] ' + form.elements.namedItem('name').value;
    form.elements.namedItem('_next').value = new URL('thanks.html', location.href).href;
    sending = true; submit.disabled = true; submit.textContent = '제출 진행 중…'; form.setAttribute('aria-busy', 'true');
    formStatus('스팸 방지 확인 화면으로 이동합니다. 확인을 마치면 접수 안내로 돌아옵니다.', 'sending');
    // FormSubmit only sends the acknowledgement and submission copy for native,
    // captcha-enabled POSTs. Do not replace this with AJAX or disable reCAPTCHA.
    HTMLFormElement.prototype.submit.call(form);
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  const appDiv = document.getElementById('app');

  fetch('/api/ping')
    .then(response => response.json())
    .then(data => {
      appDiv.textContent = data.message;
    })
    .catch(error => {
      console.error('Error fetching ping:', error);
      appDiv.textContent = 'Failed to fetch data from server.';
    });
});
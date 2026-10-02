// Simple contact form alert (can replace later with Firebase function)
document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();
  alert("Thanks! We'll get back to you shortly.");
  this.reset();
});

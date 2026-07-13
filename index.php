<!DOCTYPE html>
<html>
<head>
  <title>Multiplier-GEN-AI</title>
  <style>
    /* Define styles for the full-screen iframe */
    #fullscreen-iframe {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none; /* Remove iframe border */
    }
  </style>
</head>
<body>

  <iframe id="fullscreen-iframe">
  </iframe>

  <script>
    // JavaScript to set the iframe source to the desired web URL
    const iframe = document.getElementById("fullscreen-iframe");
    const webUrl = "https://ai-capa-compass.lovable.app/"; // Replace with the URL you want to display
    iframe.src = webUrl;
  </script>
</body>
</html>

<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$target_dir = "assets/images/";

// Create directory if it doesn't exist
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0777, true);
}

if (isset($_FILES["image"])) {
    $filename = time() . '-' . basename($_FILES["image"]["name"]);
    $filename = preg_replace("/\s+/", "-", $filename); // Remove spaces
    $target_file = $target_dir . $filename;
    
    if (move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
        // Construct the full URL
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'];
        $uri = rtrim(dirname($_SERVER['PHP_SELF']), '/\\');
        $full_url = $protocol . "://" . $host . $uri . "/" . $target_file;
        
        echo json_encode([
            "success" => true,
            "imageUrl" => $full_url,
            "filename" => $filename
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to move uploaded file."]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "No file uploaded."]);
}
?>

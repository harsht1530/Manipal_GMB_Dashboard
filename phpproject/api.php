<?php
// api.php
// Helper functions to fetch data from the backend API

require_once 'config.php';

function fetch_from_api($endpoint, $data = null, $method = 'GET') {
    global $API_BASE_URL;
    $url = $API_BASE_URL . $endpoint;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For dev/staging if needed
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
        }
    }
    
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        return ['success' => false, 'error' => $error];
    }
    
    return json_decode($response, true);
}

function get_all_doctors() {
    return fetch_from_api('/doctors');
}

function get_doctor_details($name) {
    return fetch_from_api('/doctor-details/' . rawurlencode($name));
}

function get_reviews($email, $location) {
    return fetch_from_api('/reviews', ['email' => $email, 'location' => $location], 'POST');
}
?>

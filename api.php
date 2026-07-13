<?php
// ini_set('display_errors', 1);
// ini_set('log_errors', 1);




// Allow from any origin
header("Access-Control-Allow-Origin: *");

// Allow specific methods (GET, POST, etc.)
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");

// Allow specific headers
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight requests
// if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
//     // Send an OK status for preflight requests
//     http_response_code(200);
//     exit();
// }
include_once __DIR__ . '/vendor1/autoload.php';
include_once __DIR__ . '/vendor/autoload.php';
include_once __DIR__ . '/vendor2/autoload.php';
include_once __DIR__ . '/MyBusiness.php';
include_once __DIR__ . '/db.php';



$content = json_decode(file_get_contents('php://input'),true);
// print_r($content);exit;
//v1
$credentials = __DIR__ . '/client_secrets.json';
$client = new Google\Client();
$client->setAuthConfig($credentials);
// $client->addScope("https://www.googleapis.com/auth/business.manage");
$client->addScope([
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/businessprofilebusinessinformation'
]);

$redirect_uri = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF'];
$client->setRedirectUri($redirect_uri);



$sql = "SELECT * FROM api_accesstokens WHERE email_id='".$content['email']."'";
$result = mysqli_query($conn, $sql);

if (!$result || mysqli_num_rows($result) == 0) {
    http_response_code(404);
    echo json_encode([
        "error" => "No token found for this email",
        "email" => $content['email']
    ]);
    exit;
}

$row = mysqli_fetch_assoc($result);  // IMPORTANT change

$json_token = $row['access_token']; // <-- use actual column name




//print_r($json_token);exit;
$client->setAccessToken(json_decode($json_token, true));


// v4
$scriptUri = "http://" . $_SERVER["HTTP_HOST"] . $_SERVER['PHP_SELF'];
// $scriptUri = "https://developers.google.com/oauthplayground";
$client1 = new Google_Client();
$client1->setAccessType('offline'); // default: offline
$client1->setApplicationName('GMB-MULTIPLIER');
$client1->setClientId('671454541441-248883kn7voc6mk865v4a6hp4imtpu4u.apps.googleusercontent.com');
$client1->setClientSecret('7EsGg9w8fbohX2AaWQ7JdF8P');
$client1->setRedirectUri($scriptUri);
$client1->setDeveloperKey('AIzaSyBA58HZXTN3S3l2OfuwmCeMVna-Flwilvk'); // API key
$client1->addScope("https://www.googleapis.com/auth/business.manage");
$client1->setApprovalPrompt("force");
$client1->setAccessToken(json_decode($json_token, true));


$optParams = array(
    'readMask' => array(
        'storeCode',
        'regularHours',
        'name',
        'languageCode',
        'title',
        'phoneNumbers',
        'categories',
        'storefrontAddress',
        'websiteUri',
        'regularHours',
        'specialHours',
        'serviceArea',
        'labels',
        'adWordsLocationExtensions',
        'latlng',
        'openInfo',
        'metadata',
        'profile',
        'relationshipData',
        'moreHours'
        

    )
);

$my_business_metric = new Google_Service_BusinessProfilePerformance($client);
$my_business_management = new Google_Service_MyBusinessAccountManagement($client);
$my_business_account = new Google_Service_MyBusinessBusinessInformation($client);
$my_business_calls = new Google_Service_MyBusinessBusinessCalls($client);
$mybusinessService = new Google_Service_Mybusiness($client1);
// $optParams = [];
// $res = $my_business_calls->locations->getBusinesscallssettings('locations/14037936907459350549');
// print_r(json_encode($res));exit;
//************************Account_details*******

$list_accounts_response = $my_business_management->accounts->listAccounts();
// print_r($list_accounts_response);exit;
$account_id = json_decode(json_encode($list_accounts_response),true)['accounts'][0]['name'];

if($content['function']=='get_account_id'){
    
    echo $account_id;
 }
//************************End Account_details*******

//************************Calling Functions*******
if($content['function']=='locationList'){
   $optParams['pageToken'] = array_key_exists('pageToken',$content) ? $content['pageToken'] : '';
   $response = locationList($account_id,$optParams,$my_business_account);
//    print_r($response);exit;
   echo json_encode($response);
}
// **********this is for to get detail of particular locations***********
elseif($content['function']=='locDetails'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    if($location){
        $location = explode("/",$location)[2]."/".explode("/",$location)[3];
    }
    if($location){
        $response = locDetails($location,$optParams,$my_business_account,$account_id);
        echo json_encode($response);
    }else{
        echo "Please provide location";
    }
}
//**********this is for get all reviews count and comment**********
elseif($content['function']=='reviews'){
    // print_r(json_encode($content));exit;
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    $pageToken = array_key_exists("pageToken",$content) ? $content['pageToken'] : false;
    if($location){
        $review = reviews($mybusinessService,$location,$pageToken);
        echo json_encode($review);
    }else{
        echo "Please provide location";
    }
}
elseif($content['function']=='replyreviews'){
    $location = array_key_exists("name",$content) ? $content['name'] : false;
    $text = array_key_exists("text",$content) ? $content['text'] : false;
    if($location && $text){
        $rep = new \Google_Service_MyBusiness_ReviewReply;
        $rep->setComment($text);

        $singlereply = replyreviews($mybusinessService,$location,$rep);
        echo json_encode($singlereply);
    }
}
elseif($content['function']=='localposts'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    if($location){
        $response = localposts($mybusinessService,$location);
    echo json_encode($response);
    }else{
        echo "Please provide location";
    }
}
elseif($content['function']=='businessImpressions'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    $startTime = array_key_exists("startTime",$content) ? $content['startTime'] : false;
    $endTime = array_key_exists("endTime",$content) ? $content['endTime'] : false;
    if($location){
        $location = explode("/",$location)[2]."/".explode("/",$location)[3];
    }
    if($location){
        $response = businessImpressions($my_business_metric, $location, $startTime, $endTime);
        echo json_encode($response);
    }else{
        echo "Please provide location";
    }
}
elseif($content['function']=='phonemetrics'){
    // $location = array_key_exists("location",$content) ? $content['location'] : false;
    // if($location){
    //     $location = explode("/",$location)[2]."/".explode("/",$location)[3];
    // }
    // if($location){
    //     $response = phonemetrics($location, $my_business_metric);
    //     echo json_encode($response);
    // }else{
    //     echo "Please provide location";
    // }


    $location = array_key_exists("location", $content) ? $content['location'] : false;
$startTime = array_key_exists("startTime", $content) ? $content['startTime'] : false;
$endTime = array_key_exists("endTime", $content) ? $content['endTime'] : false;

if ($location) {
    $parts = explode("/", $location);
    if (count($parts) >= 4) {
        $location = $parts[2] . "/" . $parts[3];
    } else {
        $location = false;
    }
}

if ($location && $startTime && $endTime) {
    $start_parts = explode("-", $startTime);
    $end_parts = explode("-", $endTime);

    $dateParts = [
        'start_day' => $start_parts[2],
        'start_month' => $start_parts[1],
        'start_year' => $start_parts[0],
        'end_day' => $end_parts[2],
        'end_month' => $end_parts[1],
        'end_year' => $end_parts[0]
    ];

    $response = phonemetrics($location, $my_business_metric, $dateParts);
} else {
    echo "Please provide location, startTime, and endTime";
}


}

elseif($content['function']=='searchmetrics'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    $startTime = array_key_exists("startTime",$content) ? $content['startTime'] : false;
    $endTime = array_key_exists("endTime",$content) ? $content['endTime'] : false;
    if($location && $startTime && $endTime){
        $content['loc'] = $location;
        $value = searchmetrics($account_id,$mybusinessService,$content);
        echo json_encode($value);exit;
    }else{
        echo "Please provide location,startTime, and endTime";exit;
    }
}
elseif($content['function']=='keyword_search_count'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    if($location){
        $location = explode("/",$location)[2]."/".explode("/",$location)[3];
    }
    if($location){
        $response = keyword_search_count($my_business_metric,$location,$content);
        echo json_encode($response);
    }else{
        echo "Please provide location";
    }
}
elseif($content['function']=='eventpost'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    
    if($location){
        $content['loc'] = $location;
        $value = eventpost($mybusinessService,$content);
        echo json_encode($value);exit;
    }else{
        echo "Please provide location,startTime, and endTime";exit;
    }
}
elseif($content['function']=='actionpost'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    
    if($location){
        $content['loc'] = $location;
        $value = actionpost($mybusinessService,$content);
        echo json_encode($value);exit;
    }else{
        echo "Please provide location";exit;
    }
}

elseif($content['function']=='getposts'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;

    if($location){
        $content['loc'] = $location;

        $value = getposts($mybusinessService, $content);
        echo json_encode($value);exit;
    }else{
        echo "Please provide location";exit;
    }
}

elseif($content['function']=='deletepost'){
    $location = array_key_exists("location",$content) ? $content['location'] : false;
    $post_name = array_key_exists("post_name",$content) ? $content['post_name'] : false;

    if($location && $post_name){
        $content['loc'] = $location;
        $content['post_name'] = $post_name;

        $value = deletepost($mybusinessService, $content);
        echo json_encode($value);exit;
    }else{
        echo "Please provide location and post_name";exit;
    }
}

// Get monthly search keyword impressions
else if ($content['action'] == "search_keywords_impressions") {
    try {
        $locationId = $content['locationId']; // e.g., "12345678901234567890"
        $startYear = $content['startYear'];   // e.g., 2022
        $startMonth = $content['startMonth']; // e.g., 1
        $endYear = $content['endYear'];       // e.g., 2022
        $endMonth = $content['endMonth'];     // e.g., 3

        $httpClient = $client->authorize();
        $url = "https://businessprofileperformance.googleapis.com/v1/locations/$locationId/searchkeywords/impressions/monthly" .
               "?monthlyRange.start_month.year=$startYear" .
               "&monthlyRange.start_month.month=$startMonth" .
               "&monthlyRange.end_month.year=$endYear" .
               "&monthlyRange.end_month.month=$endMonth";

        $response = $httpClient->get($url);
        $data = json_decode($response->getBody(), true);

        echo json_encode($data);
    } catch (Exception $e) {
        echo json_encode(["error" => $e->getMessage()]);
    }
}

elseif ($content['function'] == 'deletereply') {
    $reviewName = array_key_exists("reviewName", $content) ? $content['reviewName'] : false;

    if (!$reviewName) {
        echo json_encode([
            "status"  => "error",
            "message" => "Missing reviewName (accounts/{accountId}/locations/{locationId}/reviews/{reviewId})"
        ]);
        exit;
    }

    try {
        // Correct: pass only the review name
        $mybusinessService->accounts_locations_reviews->deleteReply($reviewName);

        echo json_encode([
            "status"  => "success",
            "message" => "Reply deleted successfully"
        ]);
    } catch (Exception $e) {
        echo json_encode([
            "status"  => "error",
            "message" => $e->getMessage()
        ]);
    }
    exit;
}
// ========== NEW: CREATE LOCATION ==========

// elseif($content['function'] == 'createLocation') {
//     $accountId = $content['accountId'];
//     $locationData = $content['location'];
    
//     // DEBUG OUTPUT - Fixed token handling
//     $tokenArray = $client->getAccessToken();
//     $tokenStr = is_array($tokenArray) ? ($tokenArray['access_token'] ?? 'null') : ($tokenArray ?? 'null');
//     error_log("Account: $accountId");
//     error_log("Category: " . ($locationData['categoryId'] ?? 'N/A'));
//     error_log("Token: " . substr((string)$tokenStr, 0, 50));
    
//     try {
//         $service = new Google_Service_MyBusinessBusinessInformation($client);
//         error_log("Service created OK");
        
//         $location = new Google_Service_MyBusinessBusinessInformation_Location();
//         $location->setTitle($locationData['title']);
//         $location->setLanguageCode('en-IN');  // Required: BCP-47 code, use 'en' or match your region
//         error_log("Title set: " . $locationData['title']);
        
//         // Full address setup - all fields required for geocoding
//         $address = new Google_Service_MyBusinessBusinessInformation_PostalAddress();
//         $address->setAddressLines([$locationData['address']]);
//         $address->setLocality($locationData['city']);
//         $address->setAdministrativeArea($locationData['state']);
//         $address->setPostalCode($locationData['postalCode']);
//         $address->setRegionCode($locationData['country']);
//         $location->setStorefrontAddress($address);
//         error_log("Address set");

//         // Add explicit lat/lng to bypass pin drop
//         $latLng = new Google_Service_MyBusinessBusinessInformation_LatLng();
//         $latLng->setLatitude(16.5062);
//         $latLng->setLongitude(80.6480);
//         $location->setLatLng($latLng);
        
//         // Fixed phone numbers
//         $phoneNumbers = new Google_Service_MyBusinessBusinessInformation_PhoneNumbers();
//         $phoneNumbers->setPrimaryPhone($locationData['phone']);
//         $location->setPhoneNumbers($phoneNumbers);
//         error_log("Phone set: " . $locationData['phone']);
        
//         // Fixed categories
//         $primaryCategory = new Google_Service_MyBusinessBusinessInformation_Category();
//         $primaryCategory->setName($locationData['categoryId']);
//         $categories = new Google_Service_MyBusinessBusinessInformation_Categories();
//         $categories->setPrimaryCategory($primaryCategory);
//         $location->setCategories($categories);
//         error_log("Category set: " . $locationData['categoryId']);
        
//         // Website if provided
//         if (!empty($locationData['website'])) {
//             $location->setWebsiteUri($locationData['website']);
//         }
        
//         $result = $service->accounts_locations->create($accountId, $location);
//         echo json_encode(['success' => true, 'name' => $result->getName()]);
        
//     } catch (Exception $e) {
//         error_log("Create location error: " . $e->getMessage());
//         echo json_encode([
//             'error' => $e->getMessage(),
//             'code' => $e->getCode(),
//             'file' => $e->getFile(),
//             'line' => $e->getLine()
//         ]);
//     }
// }

// ========== UPDATED: CREATE LOCATION ============

// ========== START VERIFICATION ==========
elseif ($content['function'] === 'startVerification') {

    $locationName = $content['location']; // locations/xxxx
    $method       = $content['method'];   // SMS | PHONE_CALL
    $phone        = $content['phone'];    // phone to receive OTP

    try {
        $service = new Google_Service_MyBusinessVerifications($client);

        /* ---------- VERIFY REQUEST ---------- */
        $request = new Google_Service_MyBusinessVerifications_VerifyLocationRequest();
        $request->setMethod($method);          // SMS or PHONE_CALL
        $request->setPhoneNumber($phone);      // Required
        $request->setLanguageCode('en-IN');    // ✅ REQUIRED (FIX)

        /* ---------- API CALL ---------- */
        $response = $service->locations->verify($locationName, $request);

        echo json_encode([
            "success" => true,
            "message" => "Verification initiated successfully",
            "rawResponse" => $response
        ]);
        exit;

    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "error"   => $e->getMessage(),
            "code"    => $e->getCode()
        ]);
        exit;
    }
}










// ========== START VERIFICATION ==========
elseif ($content['function'] === 'startVerification') {

    $locationName = $content['location']; // locations/xxxx
    $method       = $content['method'];   // SMS | PHONE_CALL
    $phone        = $content['phone'];    // required

    try {
        $service = new Google_Service_MyBusinessVerifications($client);

        /* ---------- VERIFICATION OPTION ---------- */
        $option = new Google_Service_MyBusinessVerifications_VerificationOption([
            'verificationMethod' => $method,
            'phoneNumber'        => $phone
        ]);

        /* ---------- VERIFY REQUEST (IMPORTANT FIX) ---------- */
        $request = new Google_Service_MyBusinessVerifications_VerifyLocationRequest([
            'verificationOption' => $option
        ]);

        /* ---------- API CALL ---------- */
        $response = $service->locations->verify($locationName, $request);

        echo json_encode([
            "success" => true,
            "message" => "Verification started",
            "rawResponse" => $response
        ]);
        exit;

    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "error"   => $e->getMessage(),
            "code"    => $e->getCode()
        ]);
        exit;
    }
}



// ========== COMPLETE VERIFICATION ==========
elseif ($content['function'] === 'completeVerification') {

    $locationName = $content['location'] ?? null;
    $otp          = $content['code'] ?? null;

    if (!$locationName || !$otp) {
        echo json_encode([
            "success" => false,
            "message" => "location or OTP code missing"
        ]);
        exit;
    }

    try {
        $service = new Google_Service_MyBusinessVerifications($client);

        /* ---------- COMPLETE REQUEST ---------- */
        $request = new Google_Service_MyBusinessVerifications_CompleteVerificationRequest();
        $request->setPin($otp);

        /* ---------- API CALL ---------- */
        $response = $service->locations->completeVerification(
            $locationName,
            $request
        );

        echo json_encode([
            "success" => true,
            "message" => "Location verified successfully",
            "rawResponse" => $response
        ]);
        exit;

    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "error"   => $e->getMessage(),
            "code"    => $e->getCode()
        ]);
        exit;
    }
}





elseif ($content['function'] === 'completeLocation') {

    global $client;

    $locationName = $content['location'] ?? null;
    $profile      = $content['profile'] ?? [];

    if (!$locationName) {
        echo json_encode(["success" => false, "message" => "location missing"]);
        exit;
    }

    try {

        $service  = new Google_Service_MyBusinessBusinessInformation($client);
        $service->rootUrl = 'https://mybusinessbusinessinformation.googleapis.com/';
        $service->servicePath = 'v1beta/';

        $location = new Google_Service_MyBusinessBusinessInformation_Location();
        $updateMask = [];

        /* ---------- PHONE NUMBERS (FIXED) ---------- */
        if (!empty($profile['primaryPhone']) || !empty($profile['additionalPhones'])) {

            $phones = new Google_Service_MyBusinessBusinessInformation_PhoneNumbers();

            if (!empty($profile['primaryPhone'])) {
                $phones->setPrimaryPhone($profile['primaryPhone']);
            }

            if (!empty($profile['additionalPhones'])) {
                $phones->setAdditionalPhones($profile['additionalPhones']);
            }

            $location->setPhoneNumbers($phones);
            $updateMask[] = 'phoneNumbers';
        }


        /* ---------- STORE CODE ---------- */
        if (!empty($profile['storeCode'])) {
            $location->setStoreCode($profile['storeCode']);
            $updateMask[] = 'storeCode';
        }

        /* ---------- WEBSITE ---------- */
        if (!empty($profile['websiteUrl'])) {
            $location->setWebsiteUri($profile['websiteUrl']);
            $updateMask[] = 'websiteUri';
        }

        if (empty($updateMask)) {
            throw new Exception("Nothing to update");
        }

        $result = $service->locations->patch(
            $locationName,
            $location,
            ['updateMask' => implode(',', $updateMask)]
        );

        echo json_encode([
            "success"    => true,
            "message"    => "Location updated successfully",
            "location"   => $result->getName(),
            "updateMask" => implode(',', $updateMask)
        ]);
        exit;

    } catch (Exception $e) {

        echo json_encode([
            "success" => false,
            "error"   => $e->getMessage(),
            "code"    => $e->getCode()
        ]);
        exit;
    }
}



// ========== CHECK VERIFICATION OPTIONS ==========
elseif ($content['function'] === 'checkVerification') {

    global $client;

    $locationName = $content['location'] ?? null;

    if (!$locationName) {
        echo json_encode([
            "success" => false,
            "message" => "location missing"
        ]);
        exit;
    }

    try {
        $service = new Google_Service_MyBusinessVerifications($client);

        $request = new Google_Service_MyBusinessVerifications_FetchVerificationOptionsRequest();
        $request->setLanguageCode('en-IN');

        $response = $service->locations->fetchVerificationOptions(
            $locationName,
            $request
        );

        // ✅ VERSION SAFE OUTPUT
        echo json_encode([
            "success" => true,
            "location" => $locationName,
            "rawResponse" => json_decode(json_encode($response), true)
        ]);
        exit;

    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "error"   => $e->getMessage(),
            "code"    => $e->getCode()
        ]);
        exit;
    }
}

// =====================For Verification Counts======================

elseif($content['function']=='testVerification')
{
    try {

        $service = new Google_Service_MyBusinessVerifications($client);

        $locationName = $content['location'];

        $request = new Google_Service_MyBusinessVerifications_FetchVerificationOptionsRequest();

        $request->setLanguageCode("en-US");

        $response = $service->locations->fetchVerificationOptions(
            $locationName,
            $request
        );

        echo json_encode([
            "success" => true,
            "data" => $response
        ]);

    } catch(Exception $e) {

        echo json_encode([
            "success" => false,
            "error" => $e->getMessage()
        ]);

    }
}



// echo "<pre>";
// print_r(get_class_methods($my_business_management));
// exit;

elseif($content['function']=='locationAdmins'){

    $location = array_key_exists("location",$content) ? $content['location'] : false;

    if(!$location){
        echo json_encode([
            "error"=>"Please provide location"
        ]);
        exit;
    }

    try{

        // Get location details
        $locationData = $my_business_account->locations->get(
            $location,
            $optParams
        );

        $locationData = json_decode(json_encode($locationData),true);

        // Get location admins
        $admins = $my_business_management
                    ->locations_admins
                    ->listLocationsAdmins($location);

        $adminsData = json_decode(json_encode($admins),true);

        $primaryOwner = [];
        $owners = [];
        $managers = [];

        if(isset($adminsData['admins'])){

            foreach($adminsData['admins'] as $admin){

                $adminInfo = [
                    "name" => $admin['admin'] ?? '',
                    "resource" => $admin['name'] ?? ''
                ];

                $role = $admin['role'] ?? '';

                if($role == 'PRIMARY_OWNER'){
                    $primaryOwner[] = $adminInfo;
                }
                elseif($role == 'OWNER'){
                    $owners[] = $adminInfo;
                }
                elseif(
                    $role == 'MANAGER' ||
                    $role == 'SITE_MANAGER'
                ){
                    $managers[] = $adminInfo;
                }
            }
        }

        $response = [

            "Profile Name" => $locationData['title'] ?? '',

            "Location ID" => $locationData['name'] ?? '',

            "Profile Link" =>
                $locationData['metadata']['mapsUri'] ?? '',

            "Place ID" =>
                $locationData['metadata']['placeId'] ?? '',

            "Review URL" =>
                $locationData['metadata']['newReviewUri'] ?? '',

            "Verification Status" =>
                $locationData['metadata']['verificationState'] ?? '',

            "Primary Ownership" => $primaryOwner,

            "Secondary Ownership" => $owners,

            "Manager Level Access" => $managers,

            "Admin Count" =>
                count($primaryOwner)+count($owners)+count($managers)
        ];

        echo json_encode($response, JSON_PRETTY_PRINT);

    }catch(Exception $e){

        echo json_encode([
            "error"=>$e->getMessage()
        ]);
    }
}








//************************End Calling Functions*******

// **********this is for to get all location of one account**********
// function actionpost($mybusinessService, $content)
// {
//     $post_body = new \Google_Service_MyBusiness_LocalPost;
//     $post_body->setLanguageCode('en-US');
//     $post_body->setSummary($content['posts_text']); // post text

//     // $event = new \Google_Service_MyBusiness_LocalPostEvent;
//     // $event->setTitle("demo");
//     // $sdate = new \Google_Service_MyBusiness_Date;
//     // $sdate->setDay($content['startDay']);
//     // $sdate->setMonth($content['startMonth']);
//     // $sdate->setYear($content['startYear']);
//     // $stime = new \Google_Service_MyBusiness_TimeOfDay;
//     // $stime->setHours($content['startHours']);
//     // $stime->setMinutes($content['startMinutes']);
//     // $stime->setSeconds(0);
//     // $stime->setNanos(0);
//     // $enddate = new \Google_Service_MyBusiness_Date;
//     // $enddate->setDay($content['endDay']);
//     // $enddate->setMonth($content['endMonth']);
//     // $enddate->setYear($content['endYear']);
//     // $etime = new \Google_Service_MyBusiness_TimeOfDay;
//     // $etime->setHours($content['endHours']);
//     // $etime->setMinutes($content['endMinutes']);
//     // $etime->setSeconds(0);
//     // $etime->setNanos(0);
//     // $schedule = new \Google_Service_MyBusiness_TimeInterval;
//     // $schedule->setStartDate($sdate);
//     // $schedule->setStartTime($stime);
//     // $schedule->setEndDate($enddate);
//     // $schedule->setEndTime($etime);
//     // $event->setSchedule($schedule);

//     // $post_body->setEvent($event);


//     $call = new \Google_Service_MyBusiness_CallToAction;
//     $call->setActionType($content['post_action_type']); // call to action type, see https://developers.google.com/my-business/content/posts-data#call_to_action_posts
//     $call->setUrl($content['post_action_url']); // URL to link to  $call->setUrl('tel:' . $content['post_action_url']); // Set phone number to call
//     $post_body->setCallToAction($call);
    
//     $media = new \Google_Service_MyBusiness_MediaItem;
//     $media->setMediaFormat($content['post_media_type']);
//     $media->setSourceUrl($content['post_media_url']); // needs to be 10+k, GIFs are *not* supported
//     $post_body->setMedia($media); // get locations under first account
//     // print_r($post_body);
//     $post_body->setTopicType("OFFER");


    
//     // print "<pre>" . json_encode($post_body, JSON_PRETTY_PRINT) . "</pre>";exit;
//     $res = $mybusinessService->accounts_locations_localPosts->create($content['loc'], $post_body);
//     print "<pre>" . json_encode($res, JSON_PRETTY_PRINT) . "</pre>";

//     return (json_encode($res));
// }

function actionpost($mybusinessService, $content)
{
    $post_body = new \Google_Service_MyBusiness_LocalPost;
    $post_body->setLanguageCode('en-US');
    $post_body->setSummary($content['posts_text']); // Post text

    // Set call-to-action
    $call = new \Google_Service_MyBusiness_CallToAction;
    $call->setActionType($content['post_action_type']); // Call-to-action type
    $call->setUrl($content['post_action_url']);         // URL to link to
    $post_body->setCallToAction($call);

    // Set media
    $media = new \Google_Service_MyBusiness_MediaItem;
    $media->setMediaFormat($content['post_media_type']); // Valid: PHOTO
    $media->setSourceUrl($content['post_media_url']);    // Needs to be a valid image
    $post_body->setMedia([ $media ]); // Pass as an array

    // Set topic type (Valid values: STANDARD, EVENT, OFFER, PRODUCT)
    $post_body->setTopicType("STANDARD");

    // Execute API request
    try {
        $res = $mybusinessService->accounts_locations_localPosts->create($content['loc'], $post_body);
        print "<pre>" . json_encode($res, JSON_PRETTY_PRINT) . "</pre>";
        return json_encode($res);
    } catch (Exception $e) {
        echo 'Error creating post: ' . $e->getMessage();
        return null;
    }
}



function getposts($mybusinessService, $content)
{
    try {
        $response = $mybusinessService
            ->accounts_locations_localPosts
            ->listAccountsLocationsLocalPosts($content['loc']);

        $posts_data = [];

        if ($response->getLocalPosts()) {
            foreach ($response->getLocalPosts() as $post) {
                $posts_data[] = [
                    "post_name" => $post->getName(),          // ✅ IMPORTANT (use this for delete)
                    "summary" => $post->getSummary(),
                    "create_time" => $post->getCreateTime(),
                    "update_time" => $post->getUpdateTime(),
                    "state" => $post->getState()
                ];
            }
        }

        return [
            "status" => "success",
            "total_posts" => count($posts_data),
            "posts" => $posts_data
        ];

    } catch (Exception $e) {
        return [
            "status" => "error",
            "message" => $e->getMessage()
        ];
    }
}


function deletepost($mybusinessService, $content)
{
    try {
        // post_name should be full resource name
        // Example:
        // accounts/xxx/locations/xxx/localPosts/xxxxxxxx

        $res = $mybusinessService
            ->accounts_locations_localPosts
            ->delete($content['post_name']);

        return [
            "status" => "success",
            "message" => "Post deleted successfully",
            "post_name" => $content['post_name']
        ];

    } catch (Exception $e) {
        return [
            "status" => "error",
            "message" => $e->getMessage()
        ];
    }
}



function eventpost($mybusinessService, $content)
{
    $post_body = new \Google_Service_MyBusiness_LocalPost;
    $post_body->setLanguageCode('en');
    $post_body->setSummary($content['summary']); // post text
    $event = new \Google_Service_MyBusiness_LocalPostEvent;
    $event->setTitle($content['title']);
    $sdate = new \Google_Service_MyBusiness_Date;
    $sdate->setDay($content['startDay']);
    $sdate->setMonth($content['startMonth']);
    $sdate->setYear($content['startYear']);
    $stime = new \Google_Service_MyBusiness_TimeOfDay;
    $stime->setHours($content['startHours']);
    $stime->setMinutes($content['startMinutes']);
    $stime->setSeconds(0);
    $stime->setNanos(0);
    $enddate = new \Google_Service_MyBusiness_Date;
    $enddate->setDay($content['endDay']);
    $enddate->setMonth($content['endMonth']);
    $enddate->setYear($content['endYear']);
    $etime = new \Google_Service_MyBusiness_TimeOfDay;
    $etime->setHours($content['endHours']);
    $etime->setMinutes($content['endMinutes']);
    $etime->setSeconds(0);
    $etime->setNanos(0);
    $schedule = new \Google_Service_MyBusiness_TimeInterval;
    $schedule->setStartDate($sdate);
    $schedule->setStartTime($stime);
    $schedule->setEndDate($enddate);
    $schedule->setEndTime($etime);
    $event->setSchedule($schedule);

    $post_body->setEvent($event);
    $media = new \Google_Service_MyBusiness_MediaItem;
    $media->setMediaFormat("PHOTO");
    $media->setSourceUrl($content['imageUrl']); // needs to be 10+k, GIFs are *not* supported
    $post_body->setMedia($media); // get locations under first account
    $post_body->setTopicType("OFFER");
    // echo $content['loc'];exit;
    // print "<pre>" . json_encode($post_body, JSON_PRETTY_PRINT) . "</pre>";
    $res = $mybusinessService->accounts_locations_localPosts->create($content['loc'], $post_body);
    // print "<pre>" . json_encode($res, JSON_PRETTY_PRINT) . "</pre>";

    return (json_encode($res));
}
function searchmetrics($account, $mybusinessService, $content)
{
    $request = new \Google_Service_MyBusiness_ReportLocationInsightsRequest;
    
    $request->setLocationNames($content['loc']); 
    $actions = new \Google_Service_MyBusiness_BasicMetricsRequest;
    $actions->setMetricRequests(['metric' => 'ALL']);
    $time = new \Google_Service_MyBusiness_TimeRange;
    $starttime = date("Y-m-d",strtotime($content['startTime'])).'T22:00:00.045123456Z';
    $endTime = date("Y-m-d",strtotime($content['endTime'])).'T01:00:00.045123456Z';
    $time->setStartTime($starttime);
    $time->setEndTime($endTime);

    $actions->setTimeRange($time);
    $request->setBasicRequest($actions);
    // print_r($actions);
    // print_r($request);exit;
    $insights = $mybusinessService->accounts_locations->reportInsights($account, $request);
    $arr = $insights;
   
    return $arr;

}

function phonemetrics($location, $my_business_metric, $dateParts)
{
    $arr1 = [
        "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
        "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
        "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
        "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
        "BUSINESS_DIRECTION_REQUESTS",
        "CALL_CLICKS",
        "WEBSITE_CLICKS"
    ];

    $result = [];

    for ($i = 0; $i < count($arr1); $i++) {
        $actions = [
            "dailyMetrics" => $arr1[$i],
            "dailyRange.startDate.day" => (int)$dateParts['start_day'],
            "dailyRange.startDate.month" => (int)$dateParts['start_month'],
            "dailyRange.startDate.year" => (int)$dateParts['start_year'],
            "dailyRange.endDate.day" => (int)$dateParts['end_day'],
            "dailyRange.endDate.month" => (int)$dateParts['end_month'],
            "dailyRange.endDate.year" => (int)$dateParts['end_year']
        ];

        $locationmetric = $my_business_metric->locations->fetchMultiDailyMetricsTimeSeries($location, $actions);
        $result[] = $locationmetric;
    }

    echo json_encode($result);
    exit;
}




// function phonemetrics($location,$my_business_metric)
// {
//     // echo $location;exit;
//     $arr1 = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_DIRECTION_REQUESTS", "CALL_CLICKS", "WEBSITE_CLICKS"];
//     for($i = 0; $i < count($arr1); $i++)
//     {
//         $actions = [
//             "dailyMetrics" => $arr1[$i],
//             "dailyRange.startDate.day" => 1,
//             "dailyRange.startDate.month" => 8,
//             "dailyRange.startDate.year" => 2022,
//             "dailyRange.endDate.day" => 31,
//             "dailyRange.endDate.month" => 8,
//             "dailyRange.endDate.year" => 2022
//         ];
        
//         $locationmetric =                                   $my_business_metric->locations->fetchMultiDailyMetricsTimeSeries($location, $actions);      
//         // print_r($locationmetric);exit;
//         $result[] = $locationmetric;
//     }
//     // print_r($result);
//     print_r(json_encode($result));exit;
// }
// function phonemetrics($account, $mybusinessService)
// {
//     $parameters = [];
//     $request = new \Google_Service_BusinessProfilePerformance;
//     // print_r($request->locations);exit;
//     // print_r($account);exit;
//     // print_r($mybusinessService);
//     // print_r($content);
//     // $mybusinessService->Location

//     // $request = new \Google_Service_MyBusiness_ReportLocationInsightsRequest;
    
//     // $request->setLocationNames($content['loc']); 
//     // $actions = new \Google_Service_MyBusiness_BasicMetricsRequest;
//     // $actions->setMetricRequests(['metric' => 'ALL', 'options' => ['BREAKDOWN_DAY_OF_WEEK', 'BREAKDOWN_HOUR_OF_DAY']]);
//     // $time = new \Google_Service_MyBusiness_TimeRange;
//     // $starttime = date("Y-m-d",strtotime($content['startTime'])).'T22:00:00.045123456Z';
//     // $endTime = date("Y-m-d",strtotime($content['endTime'])).'T01:00:00.045123456Z';
//     // $time->setStartTime($starttime);
//     // $time->setEndTime($endTime);
//     // print_r($time);exit;

//     // $actions->setTimeRange($time);
//     // $request->setBasicRequest($actions);
//     // $temp_arr[] = $request;
//     // print_r($account);exit;
//     // print_r($request);exit;
//     $arr1 = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_CONVERSATIONS", "BUSINESS_DIRECTION_REQUESTS", "CALL_CLICKS", "WEBSITE_CLICKS", "BUSINESS_BOOKINGS", "BUSINESS_FOOD_ORDERS", "BUSINESS_FOOD_MENU_CLICKS"];
//     for ($i = 0; $i < count($arr1); $i++) {
//         $temp_arr = [  "dailyMetrics" => $arr1[$i],
//                         // "dailyMetrics" => $arr1[$i + 1],
//                         "dailyRange.startDate.day" => 1,
//                         "dailyRange.startDate.month" => 8,
//                         "dailyRange.startDate.year" => 2022,
//                         "dailyRange.endDate.day" => 31,
//                         "dailyRange.endDate.month" => 8,
//                         "dailyRange.endDate.year" => 2022
//                     ];
//                     // print_r($temp_arr);exit;
//                     $insights = $mybusinessService->locations->fetchMultiDailyMetricsTimeSeries($account, $temp_arr);
//                     // print_r($insights);exit;
//                     // print_r($account);
//                     // print_r($temp_arr);
//                     $arr[] = $insights;
//     }
   
//     return $arr;

// }



function businessImpressions($my_business_metric, $location, $startTime, $endTime)
{
    // print_r($startTime);exit;
    $arr_new = [];
    $s_date = DateTime::createFromFormat('Y-m-d', $startTime);
    $s_year = $s_date->format('Y');
    $s_month = $s_date->format('m');
    $s_day = $s_date->format('d');

    $e_date = DateTime::createFromFormat('Y-m-d', $endTime);
    $e_year = $e_date->format('Y');
    $e_month = $e_date->format('m');
    $e_day = $e_date->format('d');
    $arr1 = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_DIRECTION_REQUESTS", "CALL_CLICKS", "WEBSITE_CLICKS"];
    // $arr1 = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"];

    for ($i = 0; $i < count($arr1); $i++) {
        $actions = [
            "dailyMetric" => $arr1[$i],
            "dailyRange.startDate.day" => $s_day,
            "dailyRange.startDate.month" => $s_month,
            "dailyRange.startDate.year" => $s_year,
            "dailyRange.endDate.day" => $e_day,
            "dailyRange.endDate.month" => $e_month,
            "dailyRange.endDate.year" => $e_year
        ];
        // print_r($location);
        // print_r($actions);
        $locationmetric = $my_business_metric->locations->getDailyMetricsTimeSeries($location, $actions);
        $loc = json_encode($locationmetric);
        $array = json_decode($loc, true);
        // print_r($array);
        $value[$arr1[$i]] = 0;
        for ($x = 0; $x <= sizeof($array); $x++) {
            $value[$arr1[$i]] += (int)$array['timeSeries']['datedValues'][$x]['value'];
        }
        // print_r($value);


    }  # code...
    print_r(json_encode($value));exit;
}




function locationList($account_id,$optParams,$my_business_account){
    $list_accounts_all_location = $my_business_account->accounts_locations->listAccountsLocations($account_id, $optParams);
    return $list_accounts_all_location;
}
function locDetails($location,$optParams,$my_business_account,$account_id){
    $data = $my_business_account->locations->get($location, $optParams);
    $data = json_decode(json_encode($data),true);
    // echo "<pre>";print_r($data);exit;
    $local_post['additionalPhones'] = "";
    $local_post['labels'] = $data['labels'];
    $local_post['languageCode'] = $data['languageCode'];
    $local_post['locationName'] = $data['title'];
    $local_post['name'] = $account_id."/".$data['name'];
    $local_post['primaryPhone'] = $data['phoneNumbers']['primaryPhone'];
    $local_post['storeCode'] = $data['storeCode'];
    $local_post['websiteUrl'] = $data['websiteUri'];
    $local_post['primaryCategory']['categoryId'] = $data['categories']['primaryCategory']['name'];
    $local_post['primaryCategory']['displayName'] = $data['categories']['primaryCategory']['displayName'];

    for ($i=0; $i < sizeof($data['regularHours']['periods']); $i++) { 
        $local_post['regularHours']['periods'][$i]['closeDay'] = $data['regularHours']['periods'][$i]['closeDay'];
        if(empty($data['regularHours']['periods'][$i]['closeTime']['minutes'])){
            $local_post['regularHours']['periods'][$i]['closeTime'] = $data['regularHours']['periods'][$i]['closeTime']['hours'].":00";
        }else{
            $local_post['regularHours']['periods'][$i]['closeTime'] = $data['regularHours']['periods'][$i]['closeTime']['hours'].":".$data['regularHours']['periods'][$i]['closeTime']['minutes'];
        }
        $local_post['regularHours']['periods'][$i]['openDay'] = $data['regularHours']['periods'][$i]['openDay'];
        if(empty($data['regularHours']['periods'][$i]['openTime']['minutes'])){
            $local_post['regularHours']['periods'][$i]['openTime'] = $data['regularHours']['periods'][$i]['openTime']['hours'].":00";
        }else{
            $local_post['regularHours']['periods'][$i]['openTime'] = $data['regularHours']['periods'][$i]['openTime']['hours'].":".$data['regularHours']['periods'][$i]['openTime']['minutes'];
        }
    }
    $local_post['serviceArea']['businessType'] = $data['serviceArea']['businessType'];
    $local_post['serviceArea']['places']['placeInfos'][0]['name'] = $data['serviceArea']['places']['placeInfos'][0]['placeName'];
    $local_post['serviceArea']['places']['placeInfos'][0]['placeId'] = $data['serviceArea']['places']['placeInfos'][0]['placeId'];

    $local_post['locationKey']['explicitNoPlaceId'] = null;
    $local_post['locationKey']['placeId'] = $data['metadata']['placeId'];
    $local_post['locationKey']['plusPageId'] = null;
    $local_post['locationKey']['requestId'] = null;

    $local_post['latlng'] = array_key_exists('latlng',$data) ? $data['latlng'] : "";
    $local_post['openInfo'] = $data['openInfo'];
    $local_post['locationState'] = $data['metadata'];

    $local_post['attributes'] = array();

    $local_post['metadata']['mapsUrl'] = $data['metadata']['mapsUri'];
    $local_post['metadata']['newReviewUrl'] = $data['metadata']['newReviewUri'];

    $local_post['priceLists'] = array();

    $local_post['address'] = $data['storefrontAddress'];

    // echo "<pre>";print_r($local_post);exit;
    return $local_post;
}
function reviews($mybusinessService,$location,$pageToken){
    $optParams['pageToken'] = $pageToken;
    $listreviews = $mybusinessService->accounts_locations_reviews->listAccountsLocationsReviews($location,$optParams);
    return $listreviews;
}

function replyreviews($mybusinessService,$location,$rep){
    // $arr = [];
    $reviewsObj = $mybusinessService->accounts_locations_reviews;
    $resp = $reviewsObj->updateReply($location,$rep);
    // array_push($arr, $resp);
    return $resp;
}
function localposts($mybusinessService,$location){
    $posts = $mybusinessService->accounts_locations_localPosts->listAccountsLocationsLocalPosts($location);
    return $posts;
}

// **********this is for to get detail of particular locations***********
function keyword_search_count($my_business_metric,$location,$content)
{
    $arr_new = [
        "monthlyRange.endMonth.day"=>30,
        "monthlyRange.endMonth.month"=>04,
        "monthlyRange.endMonth.year"=>2023,
        "monthlyRange.startMonth.day"=>1,
        "monthlyRange.startMonth.month"=>03,
        "monthlyRange.startMonth.year"=>2023
    ];
    $value = $my_business_metric->locations_searchkeywords_impressions_monthly->listLocationsSearchkeywordsImpressionsMonthly($location, $arr_new);
    
   
    print_r(json_encode($value));exit;
}
// $accountslocation_response = $my_business_account->locations->get('locations/14037936907459350549', $optParams);
// print_r(json_encode($accountslocation_response));



//**********this is for get all reviews count and comment**********

// $reviews = $mybusinessService->accounts_locations_reviews;
// $listReviewsResponse = $reviews->listAccountsLocationsReviews('accounts/100990395082930298286/locations/4676151310013466659');
// print_r(json_encode($listReviewsResponse));


//**********this is for to comment for any single person for that locations.**********

// $arr = [];
// $rep = new \Google_Service_MyBusiness_ReviewReply;
// $rep->setComment('hello testing');
// $reviewsObj = $mybusinessService->accounts_locations_reviews;
// $resp = $reviewsObj->updateReply('accounts/100990395082930298286/locations/4676151310013466659/reviews/AbFvOqma77Ny969xXywNW83GLFdWl_JJpDoXRHYwX6NwT-ztyy-e-J6HSXyOQx5yImQpEWlpLFWj', $rep);
// array_push($arr, $resp);
// print_r(json_encode($arr));


//**********this is for to comment for all person of that locations.**********

// $arr = [];
// $rep = new \Google_Service_MyBusiness_ReviewReply;
// $rep->setComment('hello testing');
// $reviewsObj = $mybusinessService->accounts_locations_reviews;

// for ($i = 0; $i < count($content['revname']); $i++) {

// $resp = $reviewsObj->updateReply($content['revname'][$i], $rep);
// array_push($arr, $resp);
// }
// print_r(json_encode($arr));


//**********this is for to get local post of particular locations.**********

// $arr = '';
// $posts = $mybusinessService->accounts_locations_localPosts;
// $localposts = $posts->listAccountsLocationsLocalPosts('accounts/100990395082930298286/locations/4676151310013466659');
// // print_r(json_encode($localposts));exit;
// $arr = $localposts;
// print_r(json_encode($arr));

//review and comments post details



//**************this is for search json but this format got change from previous one */
// $arr_new = [];
// $arr1 = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_DIRECTION_REQUESTS", "CALL_CLICKS", "WEBSITE_CLICKS"];
// // $arr1 = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"];

// for ($i = 0; $i < count($arr1); $i++) {
//     $actions = [
//         "dailyMetric" => $arr1[$i],
//         "dailyRange.startDate.day" => 1,
//         "dailyRange.startDate.month" => 8,
//         "dailyRange.startDate.year" => 2022,
//         "dailyRange.endDate.day" => 16,
//         "dailyRange.endDate.month" => 8,
//         "dailyRange.endDate.year" => 2022
//     ];

//     $locationmetric = $my_business_metric->locations->getDailyMetricsTimeSeries('locations/7311109976534792970', $actions);
//     $loc = json_encode($locationmetric);
//     $array = json_decode($loc, true);
//     // print_r($array);
//     $value[$arr1[$i]] = 0;
//     for ($x = 0; $x <= sizeof($array); $x++) {
//         $value[$arr1[$i]] += (int)$array['timeSeries']['datedValues'][$x]['value'];
//     }
//     //   print_r($value);exit;


// }

// print_r(json_encode($value));


// *******bussiness call***********

// $param['start_date'] = "start_date=2022-07-01 AND end_date=2022-08-10 AND metric_type=AGGREGATE_COUNT";
// $param = [ "filter"=> "start_date=2022-07-01+AND+end_date=2022-08-10+AND+metric_type=AGGREGATE_COUNT"
// ];
// $businesscall = $my_business_call->locations_businesscallsinsights->listLocationsBusinesscallsinsights('locations/4676151310013466659');
// print_r(json_encode($businesscall));


// Bussiness verification

// $arr = '';
// $localverification = $mybusinessService->accounts_locations_verifications;
// // print_r(json_encode($localverification));exit;
// $localverificationnew = $localverification->listAccountsLocationsVerifications('accounts/100990395082930298286/locations/4676151310013466659');
// // print_r($localverificationnew);
// // $arr = $localverificationnew;
// print_r(json_encode($localverificationnew));


//accounts_locations_questions_answers 

// $arr='';
// $question_answer = $mybusinessService->accounts_locations_questions_answers;
// // print_r(json_encode($question_answer));exit;
// $listquestionanswers = $question_answer->listAccountsLocationsQuestionsAnswers('accounts/100990395082930298286/locations/4676151310013466659');
// $arr=$listquestionanswers;
// print_r(json_encode($arr));


// list categories

// $category = $mybusinessService->$categories;
// $catlist = $category->listCategories(['regionCode' => 'IN', 'languageCode' => 'en-US']);
// print_r(json_encode($catlist));




// actionpost



// $post_body = new \Google_Service_MyBusiness_LocalPost;
// $post_body->setLanguageCode('en');
// $post_body->setSummary($content['posts_text']); // post text
// $call = new \Google_Service_MyBusiness_CallToAction;
// $call->setActionType($content['post_action_type']); // call to action type, see https://developers.google.com/my-business/content/posts-data#call_to_action_posts
// $call->setUrl($content['post_action_url']); // URL to link to
// $post_body->setCallToAction($call);
// $media = new \Google_Service_MyBusiness_MediaItem;
// $media->setMediaFormat($content['post_media_type']);
// $media->setSourceUrl($content['post_media_url']); // needs to be 10+k, GIFs are *not* supported
// $post_body->setMedia($media); // get locations under first account
// // print_r($post_body);
// // print "<pre>" . json_encode($post_body, JSON_PRETTY_PRINT) . "</pre>";
// $res = $mybusinessService->accounts_locations_localPosts->create($content['loc'], $post_body);
// print_r(json_encode($res));


// offerpost

// $post_body = new \Google_Service_MyBusiness_LocalPost;
// $post_body->setLanguageCode('en');
// $post_body->setSummary($content['posts_text']); // post text
// $offer = new \Google_Service_MyBusiness_LocalPostOffer;
// $offer->setCouponCode($content['coupon']);
// $offer->setRedeemOnlineUrl($content['redeemURL']);
// $offer->setTermsConditions($content['termconditionURL']);

// $post_body->setOffer($offer);
// $media = new \Google_Service_MyBusiness_MediaItem;
// $media->setMediaFormat($content['post_media_type']);
// $media->setSourceUrl($content['post_media_url']); // needs to be 10+k, GIFs are *not* supported
// $post_body->setMedia($media); // get locations under first account
// $res = $mybusinessService->accounts_locations_localPosts->create($content['loc'], $post_body);
// print_r(json_encode($res));


// event post

// $post_body = new \Google_Service_MyBusiness_LocalPost;
// $post_body->setLanguageCode('en');
// $post_body->setSummary($content['posts_text']); // post text
// $event = new \Google_Service_MyBusiness_LocalPostEvent;
// $event->setTitle($content['event_title']);
// $sdate = new \Google_Service_MyBusiness_Date;
// $sdate->setDay($content['e_st_day']);
// $sdate->setMonth($content['e_st_month']);
// $sdate->setYear($content['e_st_year']);
// $stime = new \Google_Service_MyBusiness_TimeOfDay;
// $stime->setHours($content['e_st_hr']);
// $stime->setMinutes($content['e_st_min']);
// // $stime->setSeconds($content['e_st_sec']);
// $stime->setNanos(0);
// $enddate = new \Google_Service_MyBusiness_Date;
// $enddate->setDay($content['e_ed_day']);
// $enddate->setMonth($content['e_ed_month']);
// $enddate->setYear($content['e_ed_year']);
// $etime = new \Google_Service_MyBusiness_TimeOfDay;
// $etime->setHours($content['e_ed_hr']);
// $etime->setMinutes($content['e_ed_min']);
// // $etime->setSeconds($content['e_ed_sec']);
// $etime->setNanos(0);
// $schedule = new \Google_Service_MyBusiness_TimeInterval;
// $schedule->setStartDate($sdate);
// $schedule->setStartTime($stime);
// $schedule->setEndDate($enddate);
// $schedule->setEndTime($etime);
// $event->setSchedule($schedule);

// $post_body->setEvent($event);
// $media = new \Google_Service_MyBusiness_MediaItem;
// $media->setMediaFormat($content['post_media_type']);
// $media->setSourceUrl($content['post_media_url']); // needs to be 10+k, GIFs are *not* supported
// $post_body->setMedia($media); // get locations under first account
// // print "<pre>" . json_encode($post_body, JSON_PRETTY_PRINT) . "</pre>";
// $res = $mybusinessService->accounts_locations_localPosts->create($content['loc'], $post_body);
// // print "<pre>" . json_encode($res, JSON_PRETTY_PRINT) . "</pre>";

// print_r(json_encode($res));


//Locphotos

// $media = $mybusinessService->accounts_locations_media;
// $localmedia = $media->listAccountsLocationsMedia('accounts/100990395082930298286/locations/4676151310013466659');
// $arr = $localmedia;
// print_r(json_encode($arr));


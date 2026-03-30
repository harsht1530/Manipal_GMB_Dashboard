<?php
require_once 'api.php';
require_once 'config.php';

$doctor_name = $_GET['name'] ?? '';
if (empty($doctor_name)) {
    header('Location: index.php');
    exit;
}

$details_res = get_doctor_details($doctor_name);
if (!$details_res || !$details_res['success']) {
    $error_message = "Could not fetch details for " . htmlspecialchars($doctor_name);
} else {
    $profile = $details_res['data']['profile'] ?? null;
    $monthly_insights = $details_res['data']['monthlyInsights'] ?? [];
    $keywords = $details_res['data']['keywords'] ?? [];
    $competitors = $details_res['data']['competitors'] ?? [];
    
    // Fetch reviews if possible
    $review_data = null;
    if ($profile && !empty($profile['mail_id']) && !empty($profile['account'])) {
        $reviews_res = get_reviews($profile['mail_id'], $profile['account']);
        if ($reviews_res && $reviews_res['success']) {
            $review_data = $reviews_res['data'];
        }
    }
}

// Group insights by year for the filter
$available_years = [];
$tz = new DateTimeZone('Asia/Kolkata');
foreach ($monthly_insights as $insight) {
    $date_val = is_array($insight['Date']) && isset($insight['Date']['$date']) ? $insight['Date']['$date'] : ($insight['Date'] ?? '');
    if (!empty($date_val)) {
        try {
            $dt = new DateTime($date_val);
            $dt->setTimezone($tz);
            $year = $dt->format('Y');
            if (!in_array($year, $available_years)) {
                $available_years[] = $year;
            }
        } catch (Exception $e) {}
    }
}
rsort($available_years);
$selected_year = $_GET['year'] ?? ($available_years[0] ?? date('Y'));

// Helper to filter by year
function filter_by_year($data, $year) {
    if (!$data) return [];
    $tz = new DateTimeZone('Asia/Kolkata');
    return array_filter($data, function($item) use ($year, $tz) {
        $date_val = $item['Date'] ?? $item['Month'] ?? $item['date'] ?? '';
        if (is_array($date_val) && isset($date_val['$date'])) {
            $date_val = $date_val['$date'];
        }
        if (empty($date_val)) return true; // Keep items without a date by default
        
        try {
            $dt = new DateTime($date_val);
            $dt->setTimezone($tz);
            return ($dt->format('Y') == $year);
        } catch (Exception $e) {
            $ts = strtotime($date_val);
            return ($ts !== false && date('Y', $ts) == $year);
        }
    });
}

// Apply filtering to all relevant data
$filtered_insights = filter_by_year($monthly_insights, $selected_year);
$filtered_keywords = filter_by_year($keywords, $selected_year);
$filtered_competitors = filter_by_year($competitors, $selected_year);

// Sort insights from Jan to Dec
$months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
usort($filtered_insights, function($a, $b) use ($months) {
    $ma = $a['Month'] ?? '';
    $mb = $b['Month'] ?? '';
    $ia = array_search($ma, $months);
    $ib = array_search($mb, $months);
    $ia = $ia === false ? 99 : $ia;
    $ib = $ib === false ? 99 : $ib;
    return $ia - $ib;
});

// If filtered results are empty but the original wasn't, maybe they don't have dates
if (empty($filtered_keywords) && !empty($keywords)) $filtered_keywords = $keywords;
if (empty($filtered_competitors) && !empty($competitors)) $filtered_competitors = $competitors;

// Filter reviews if possible - NO LONGER FILTERING BY YEAR TO SHOW LATEST AVAILABLE
if ($review_data) {
    // Sort reviews by date latest first
    usort($review_data['goodReviews'], function($a, $b) { return strtotime($b['date']) - strtotime($a['date']); });
    usort($review_data['badReviews'], function($a, $b) { return strtotime($b['date']) - strtotime($a['date']); });
    
    // Limits like dashboard (usually top 5 each)
    $review_data['goodReviews'] = array_slice($review_data['goodReviews'], 0, 5);
    $review_data['badReviews'] = array_slice($review_data['badReviews'], 0, 5);
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $profile['name'] ?? htmlspecialchars($doctor_name); ?> - Detailed Report | Manipal Hospitals</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.highcharts.com/highcharts.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #217a74;
            --primary-foreground: #ffffff;
            --background: #f8fafc;
            --card: #ffffff;
            --foreground: #0f172a;
            --muted: #f1f5f9;
            --muted-foreground: #64748b;
            --border: #e2e8f0;
            --success: #22c55e;
            --warning: #f59e0b;
            --destructive: #ef4444;
        }
        body {
            font-family: 'DM Sans', sans-serif;
            background-color: var(--background);
            color: var(--foreground);
        }
        .tab-active {
            border-bottom: 3px solid var(--primary);
            color: var(--primary);
            font-weight: 700;
            background-color: rgba(33, 122, 116, 0.08); /* More prominent active background */
        }
        .tab-btn {
            transition: all 0.2s ease-in-out;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            border-top-left-radius: 0.75rem;
            border-top-right-radius: 0.75rem;
        }
        .tab-btn:hover:not(.tab-active) {
            background-color: var(--muted);
        }
        .chart-container {
            width: 100%;
            height: 400px;
        }
    </style>
</head>
<body class="min-h-screen">
    <!-- Header -->
    <header class="bg-white border-b sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <a href="index.php" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </a>
                <img src="<?php echo $MANIPAL_LOGO; ?>" alt="Manipal Logo" class="h-10">
                <div class="hidden sm:block h-6 w-px bg-gray-200 mx-2"></div>
                <h1 class="hidden sm:block text-lg font-bold text-gray-900"><?php echo $profile['name'] ?? htmlspecialchars($doctor_name); ?></h1>
            </div>
            <div class="flex gap-2">
                <button id="downloadExcel" class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all">
                    <svg class="h-4 w-4 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Excel
                </button>
                <button id="downloadPDF" class="inline-flex items-center px-4 py-2 bg-[#217a74] border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:bg-[#1a635e] transition-all">
                    <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    PDF Report
                </button>
            </div>
        </div>
    </header>

    <main id="reportContent" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <?php if (isset($error_message)): ?>
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl relative" role="alert">
                <strong class="font-bold">Error!</strong>
                <span class="block sm:inline"><?php echo $error_message; ?></span>
            </div>
        <?php elseif (!$profile): ?>
            <div class="text-center py-24">
                <h2 class="text-2xl font-bold text-gray-900">Profile Not Found</h2>
                <p class="text-gray-500 mt-2">The requested doctor profile could not be loaded.</p>
                <a href="index.php" class="mt-6 inline-block text-[#217a74] font-medium hover:underline">Back to Selection</a>
            </div>
        <?php else: ?>

            <!-- Profile Overview Card -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                <div class="flex flex-col md:flex-row gap-8 items-start justify-between">
                    <div class="space-y-4 flex-1">
                        <div class="flex items-center gap-3">
                            <h2 class="text-3xl font-bold text-gray-900"><?php echo $profile['name']; ?></h2>
                            <span class="px-3 py-1 bg-[#217a74]/10 text-[#217a74] text-xs font-bold rounded-full uppercase tracking-wider"><?php echo $profile['primaryCategory']; ?></span>
                        </div>
                        
                        <div class="flex items-center gap-2 text-gray-600">
                            <svg class="h-5 w-5 text-yellow-500 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            <span class="font-bold text-lg text-gray-900"><?php echo number_format($profile['averageRating'] ?? 0, 1); ?></span>
                            <span class="text-gray-500">(<?php echo $profile['totalReviewCount'] ?? 0; ?> reviews)</span>
                        </div>

                        <div class="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                            <div class="flex items-start gap-3">
                                <svg class="h-5 w-5 text-[#217a74] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span class="text-sm text-gray-600"><?php echo $profile['address'] ?? 'No address provided'; ?></span>
                            </div>
                            <div class="flex items-center gap-3">
                                <svg class="h-5 w-5 text-[#217a74]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                <span class="text-sm text-gray-600"><?php echo $profile['phone'] ?? 'No phone provided'; ?></span>
                            </div>
                        </div>
                    </div>
                    <?php if (!empty($profile['profile_screenshot'])): ?>
                    <div class="hidden lg:block shrink-0">
                        <img src="https://multipliersolutions.in/gmbprofiles/Manipal/<?php echo $profile['profile_screenshot']; ?>" 
                             alt="Profile Screenshot" class="h-32 rounded-xl border border-gray-100 shadow-sm object-cover">
                    </div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="border-b border-gray-200">
                <nav class="flex space-x-8 overflow-x-auto pb-1" aria-label="Tabs">
                    <button onclick="switchTab('insights')" id="tabBtn-insights" class="tab-btn pb-4 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all whitespace-nowrap">Monthly Insights</button>
                    <button onclick="switchTab('keywords')" id="tabBtn-keywords" class="tab-btn pb-4 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all whitespace-nowrap">Keyword Rankings</button>
                    <button onclick="switchTab('competitors')" id="tabBtn-competitors" class="tab-btn pb-4 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all whitespace-nowrap">Competitors</button>
                    <button onclick="switchTab('visuals')" id="tabBtn-visuals" class="tab-btn pb-4 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all whitespace-nowrap">Visuals</button>
                    <button onclick="switchTab('reviews')" id="tabBtn-reviews" class="tab-btn pb-4 px-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all whitespace-nowrap">Reviews</button>
                </nav>
            </div>

            <!-- Tab Content: Insights -->
            <div id="tab-insights" class="tab-content space-y-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-900">Performance Trends</h3>
                    <div class="flex items-center gap-3">
                        <label class="text-sm font-medium text-gray-600">Year:</label>
                        <select onchange="window.location.href='doctor-details.php?name=<?php echo urlencode($doctor_name); ?>&year=' + this.value" 
                                class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-[#217a74] focus:border-[#217a74] block p-2">
                            <?php foreach ($available_years as $year): ?>
                                <option value="<?php echo $year; ?>" <?php echo $year == $selected_year ? 'selected' : ''; ?>><?php echo $year; ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div id="performanceChart" class="chart-container"></div>
                </div>

                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                        <h4 class="font-bold text-gray-900">Monthly Breakdown</h4>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="text-xs text-gray-500 uppercase bg-gray-50/30">
                                <tr>
                                    <th class="px-6 py-4">Month</th>
                                    <th class="px-6 py-4 text-center">Search Mobile</th>
                                    <th class="px-6 py-4 text-center">Search Desktop</th>
                                    <th class="px-6 py-4 text-center">Maps Mobile</th>
                                    <th class="px-6 py-4 text-center">Maps Desktop</th>
                                    <th class="px-6 py-4 text-center">Calls</th>
                                    <th class="px-6 py-4 text-center">Directions</th>
                                    <th class="px-6 py-4 text-center">Website</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                <?php 
                                foreach ($filtered_insights as $row): 
                                ?>
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="px-6 py-4 font-bold text-gray-900"><?php echo $row['Month']; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Google Search - Mobile'] ?? 0; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Google Search - Desktop'] ?? 0; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Google Maps - Mobile'] ?? 0; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Google Maps - Desktop'] ?? 0; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Calls'] ?? 0; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Directions'] ?? 0; ?></td>
                                    <td class="px-6 py-4 text-center"><?php echo $row['Website clicks'] ?? 0; ?></td>
                                </tr>
                                <?php endforeach; ?>
                                <?php if (empty($filtered_insights)): ?>
                                    <tr><td colspan="8" class="px-6 py-12 text-center text-gray-500">No data available for <?php echo $selected_year; ?></td></tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Keywords -->
            <div id="tab-keywords" class="tab-content hidden space-y-6">
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                        <h4 class="font-bold text-gray-900">Keyword Ranking Data</h4>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="text-xs text-gray-500 uppercase bg-gray-50/30">
                                <tr>
                                    <th class="px-6 py-4">Keyword</th>
                                    <th class="px-6 py-4 text-center">Rank</th>
                                    <th class="px-6 py-4">Top Competitors</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                <?php foreach ($filtered_keywords as $kw): ?>
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="px-6 py-4 font-bold text-gray-900"><?php echo $kw['label']; ?></td>
                                    <td class="px-6 py-4 text-center">
                                        <?php if (!empty($kw['rank'])): ?>
                                            <span class="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-lg <?php echo $kw['rank'] == 1 ? 'bg-green-100 text-green-700' : ($kw['rank'] <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'); ?>">
                                                #<?php echo $kw['rank']; ?>
                                            </span>
                                        <?php else: ?>
                                            <span class="text-gray-400">N/A</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex flex-wrap gap-2">
                                            <?php foreach (array_slice($kw['competitors'] ?? [], 0, 3) as $comp): ?>
                                                <span class="px-2 py-0.5 bg-gray-50 border rounded text-[10px] text-gray-600"><?php echo $comp; ?></span>
                                            <?php endforeach; ?>
                                        </div>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                                <?php if (empty($keywords)): ?>
                                    <tr><td colspan="3" class="px-6 py-12 text-center text-gray-500">No keyword ranking data available</td></tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Competitors -->
            <div id="tab-competitors" class="tab-content hidden space-y-6">
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <?php foreach ($filtered_competitors as $index => $comp): ?>
                    <div class="flex items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                        <div class="h-10 w-10 shrink-0 bg-[#217a74]/10 text-[#217a74] rounded-full flex items-center justify-center font-bold">
                            <?php echo $index + 1; ?>
                        </div>
                        <span class="font-bold text-gray-900"><?php echo $comp; ?></span>
                    </div>
                    <?php endforeach; ?>
                    <?php if (empty($competitors)): ?>
                        <div class="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-dashed text-gray-400">No competitors identified</div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Tab Content: Visuals -->
            <div id="tab-visuals" class="tab-content hidden space-y-8">
                <!-- Profile Screenshot -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                        <h4 class="font-bold text-gray-900">GMB Profile Presence</h4>
                    </div>
                    <div class="p-8 flex justify-center bg-gray-50/30">
                        <?php if (!empty($profile['profile_screenshot'])): ?>
                            <img src="https://multipliersolutions.in/gmbprofiles/Manipal/<?php echo $profile['profile_screenshot']; ?>" 
                                 alt="GMB Screenshot" class="max-w-2xl w-full rounded-lg shadow-lg border border-gray-200">
                        <?php else: ?>
                            <div class="text-gray-400 italic">No profile screenshot available</div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Keyword Screenshot -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                        <h4 class="font-bold text-gray-900">Top Keyword Search Result</h4>
                    </div>
                    <div class="p-8 space-y-4">
                        <?php 
                        $screenshots = array_filter($filtered_keywords, function($k) { return !empty($k['screen_shot']); });
                        $top_kw = reset($screenshots);
                        if ($top_kw):
                        ?>
                            <div class="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <span class="font-bold text-[#217a74]"><?php echo $top_kw['label']; ?></span>
                                <span class="px-2 py-1 bg-[#217a74] text-white rounded-lg text-xs">#<?php echo $top_kw['rank']; ?></span>
                            </div>
                            <img src="https://multipliersolutions.in/gmbprofiles/Manipal/<?php echo $top_kw['screen_shot']; ?>.webp" 
                                 alt="Search Result" class="w-full rounded-xl shadow-lg border border-gray-100">
                        <?php else: ?>
                            <div class="text-center py-12 text-gray-400 italic">No search result screenshots available</div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Reviews -->
            <div id="tab-reviews" class="tab-content hidden space-y-8">
                <?php if (!$review_data): ?>
                    <div class="text-center py-24 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <svg class="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        <p class="text-gray-500">Review analysis is currently unavailable for this profile.</p>
                    </div>
                <?php else: ?>
                    <div class="grid lg:grid-cols-2 gap-8">
                        <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <h4 class="font-bold text-gray-900 mb-6">Rating Distribution</h4>
                            <div id="ratingChart" class="h-64"></div>
                        </div>
                        <div class="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-6">
                            <div class="text-center">
                                <?php 
                                    $counts = $review_data['ratings'];
                                    $total_count = array_sum($counts);
                                    $avg = $total_count ? array_reduce(array_keys($counts), function($acc, $i) use ($counts) { return $acc + ($counts[$i] * ($i + 1)); }, 0) / $total_count : 0;
                                ?>
                                <h4 class="text-5xl font-bold text-gray-900"><?php echo number_format($avg, 1); ?></h4>
                                <div class="flex items-center justify-center gap-1 my-3 text-yellow-500">
                                    <?php for($i=1; $i<=5; $i++): ?>
                                        <svg class="h-6 w-6 <?php echo $i <= round($avg) ? 'fill-current' : 'text-gray-200 stroke-current'; ?>" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                    <?php endfor; ?>
                                </div>
                                <p class="text-sm font-medium text-gray-500 uppercase tracking-widest">Average Sentiment</p>
                            </div>
                            <div class="w-full h-px bg-gray-50"></div>
                            <div class="text-center">
                                <h4 class="text-4xl font-bold text-gray-900"><?php echo $total_count; ?></h4>
                                <p class="text-sm font-medium text-gray-500 uppercase tracking-widest">Analyzed Reviews</p>
                            </div>
                        </div>
                    </div>

                    <div class="grid lg:grid-cols-2 gap-8">
                        <!-- Success Stories -->
                        <div class="space-y-4">
                            <h4 class="flex items-center gap-2 font-bold text-green-700">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path h-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Recent Positive Feedback
                            </h4>
                            <div class="space-y-3">
                                <?php foreach ($review_data['goodReviews'] ?? [] as $rev): ?>
                                    <div class="p-5 bg-white rounded-2xl border border-green-50 shadow-sm">
                                        <p class="text-sm text-gray-700 leading-relaxed italic">"<?php echo htmlspecialchars($rev['comment']); ?>"</p>
                                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                                            <span class="text-xs font-bold text-gray-900"><?php echo htmlspecialchars($rev['author']); ?></span>
                                            <span class="text-[10px] text-gray-400 uppercase"><?php echo date('M Y', strtotime($rev['date'])); ?></span>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <!-- Areas for Improvement -->
                        <div class="space-y-4">
                            <h4 class="flex items-center gap-2 font-bold text-red-700">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path h-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Recent Low Ratings
                            </h4>
                            <div class="space-y-3">
                                <?php foreach ($review_data['badReviews'] ?? [] as $rev): ?>
                                    <div class="p-5 bg-white rounded-2xl border border-red-50 shadow-sm">
                                        <p class="text-sm text-gray-700 leading-relaxed italic">"<?php echo htmlspecialchars($rev['comment']); ?>"</p>
                                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                                            <span class="text-xs font-bold text-gray-900"><?php echo htmlspecialchars($rev['author']); ?></span>
                                            <span class="text-[10px] text-gray-400 uppercase"><?php echo date('M Y', strtotime($rev['date'])); ?></span>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>
            </div>

        <?php endif; ?>
    </main>

    <script>
        function switchTab(tabId) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            // Remove active class from all buttons
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
            
            // Show selected tab content
            document.getElementById('tab-' + tabId).classList.remove('hidden');
            // Add active class to selected button
            document.getElementById('tabBtn-' + tabId).classList.add('tab-active');

            // Reflow charts when switching tabs to ensure they fill container
            if (tabId === 'insights') Highcharts.charts.find(c => c && c.renderTo.id === 'performanceChart')?.reflow();
            if (tabId === 'reviews') Highcharts.charts.find(c => c && c.renderTo.id === 'ratingChart')?.reflow();
        }

        // Initialize default tab
        switchTab('insights');

        // Chart Data
        <?php 
            $labels = [];
            $data_search_mobile = [];
            $data_search_desktop = [];
            $data_maps_mobile = [];
            $data_maps_desktop = [];
            $data_calls = [];
            $data_directions = [];
            $data_website = [];
            $data_overall = [];

            foreach ($filtered_insights as $row) {
                $labels[] = $row['Month'];
                $sm = $row['Google Search - Mobile'] ?? 0;
                $sd = $row['Google Search - Desktop'] ?? 0;
                $mm = $row['Google Maps - Mobile'] ?? 0;
                $md = $row['Google Maps - Desktop'] ?? 0;
                $cl = $row['Calls'] ?? 0;
                $dr = $row['Directions'] ?? 0;
                $wb = $row['Website clicks'] ?? 0;

                $data_search_mobile[] = $sm;
                $data_search_desktop[] = $sd;
                $data_maps_mobile[] = $mm;
                $data_maps_desktop[] = $md;
                $data_calls[] = $cl;
                $data_directions[] = $dr;
                $data_website[] = $wb;
                $data_overall[] = $sm + $sd + $mm + $md;
            }
        ?>

        // Render Performance Chart
        Highcharts.chart('performanceChart', {
            chart: { type: 'line', style: { fontFamily: 'DM Sans' }, backgroundColor: 'transparent' },
            title: { text: null },
            xAxis: { categories: <?php echo json_encode($labels); ?>, gridLineWidth: 0 },
            yAxis: { title: { text: null }, gridLineColor: '#f1f5f9' },
            credits: { enabled: false },
            tooltip: { shared: true },
            plotOptions: {
                line: {
                    lineWidth: 3,
                    marker: { radius: 4 },
                    dataLabels: { enabled: true, style: { fontSize: '10px' } }
                }
            },
            series: [
                { name: 'Search Mobile', data: <?php echo json_encode($data_search_mobile); ?>, color: '#217a74' },
                { name: 'Search Desktop', data: <?php echo json_encode($data_search_desktop); ?>, color: '#0ea5e9' },
                { name: 'Maps Mobile', data: <?php echo json_encode($data_maps_mobile); ?>, color: '#22c55e' },
                { name: 'Maps Desktop', data: <?php echo json_encode($data_maps_desktop); ?>, color: '#f59e0b' },
                { name: 'Calls', data: <?php echo json_encode($data_calls); ?>, color: '#6366f1' },
                { name: 'Directions', data: <?php echo json_encode($data_directions); ?>, color: '#8b5cf6' },
                { name: 'Website Clicks', data: <?php echo json_encode($data_website); ?>, color: '#ec4899' },
                { name: 'Overall', data: <?php echo json_encode($data_overall); ?>, color: '#ef4444', dashStyle: 'Dash' }
            ]
        });

        // Render Rating Distribution Chart
        <?php if ($review_data): ?>
        Highcharts.chart('ratingChart', {
            chart: { type: 'pie', backgroundColor: 'transparent', style: { fontFamily: 'DM Sans' } },
            title: { text: null },
            credits: { enabled: false },
            plotOptions: {
                pie: {
                    innerSize: '60%',
                    dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.y}' },
                    showInLegend: true
                }
            },
            series: [{
                name: 'Rating Count',
                data: [
                    { name: '1 Star', y: <?php echo $review_data['ratings'][0]; ?>, color: '#ef4444' },
                    { name: '2 Stars', y: <?php echo $review_data['ratings'][1]; ?>, color: '#f97316' },
                    { name: '3 Stars', y: <?php echo $review_data['ratings'][2]; ?>, color: '#eab308' },
                    { name: '4 Stars', y: <?php echo $review_data['ratings'][3]; ?>, color: '#84cc16' },
                    { name: '5 Stars', y: <?php echo $review_data['ratings'][4]; ?>, color: '#22c55e' },
                ]
            }]
        });
        <?php endif; ?>

        // PDF Generation
        document.getElementById('downloadPDF').addEventListener('click', async () => {
            const { jsPDF } = window.jspdf;
            const element = document.getElementById('reportContent');
            const btn = document.getElementById('downloadPDF');
            
            btn.disabled = true;
            btn.innerText = 'Generating...';

            // Store original states
            const activeTabId = document.querySelector('.tab-btn.tab-active').id.replace('tabBtn-', '');
            const hiddenSections = document.querySelectorAll('.tab-content.hidden');
            const tabNav = document.querySelector('nav[aria-label="Tabs"]');
            
            try {
                // Prepare for PDF: Show all sections
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('hidden'));
                if (tabNav) tabNav.style.display = 'none'; // Hide tab nav in PDF

                const canvas = await html2canvas(element, { 
                    scale: 2, 
                    useCORS: true,
                    logging: false,
                    windowWidth: 1200 // Ensure wide layout for charts
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 210;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight]);
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                pdf.save('<?php echo str_replace(" ", "_", $profile["name"] ?? "Report"); ?>_Full_Report.pdf');
            } catch (e) {
                console.error(e);
                alert('PDF generation failed.');
            } finally {
                // Restore original states
                switchTab(activeTabId);
                if (tabNav) tabNav.style.display = 'flex';
                
                btn.disabled = false;
                btn.innerHTML = '<svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> PDF Report';
            }
        });

        // Excel Generation
        document.getElementById('downloadExcel').addEventListener('click', () => {
            const data = <?php echo json_encode($monthly_insights); ?>;
            const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
                Month: item.Month,
                "Search Mobile": item["Google Search - Mobile"],
                "Search Desktop": item["Google Search - Desktop"],
                "Maps Mobile": item["Google Maps - Mobile"],
                "Maps Desktop": item["Google Maps - Desktop"],
                Calls: item.Calls,
                Directions: item.Directions,
                "Website Clicks": item["Website clicks"]
            })));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Insights");
            XLSX.writeFile(workbook, "<?php echo str_replace(" ", "_", $profile["name"] ?? "Report"); ?>_GMB_Data.xlsx");
        });
    </script>
</body>
</html>

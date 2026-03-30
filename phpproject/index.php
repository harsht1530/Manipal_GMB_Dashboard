<?php
require_once 'api.php';
require_once 'config.php';

$doctors_res = get_all_doctors();
$doctors = ($doctors_res && $doctors_res['success']) ? $doctors_res['data'] : [];

// Sort doctors alphabetically by name
usort($doctors, function($a, $b) {
    return strcmp($a['name'] ?? '', $b['name'] ?? '');
});
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doctor Report Selection | Manipal Hospitals</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #217a74;
            --background: #f8fafc;
            --card: #ffffff;
            --foreground: #0f172a;
            --muted: #f1f5f9;
            --muted-foreground: #64748b;
            --border: #e2e8f0;
        }
        body {
            font-family: 'DM Sans', sans-serif;
            background-color: var(--background);
            color: var(--foreground);
        }
        .doctor-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
    </style>
</head>
<body class="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
        <div class="text-center mb-12">
            <img src="<?php echo $MANIPAL_LOGO; ?>" alt="Manipal Hospitals" class="h-16 mx-auto mb-6">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Doctor Performance Reports</h1>
            <p class="mt-4 text-lg text-gray-600">Select a doctor to view their detailed GMB performance report.</p>
        </div>

        <div class="mb-8 relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                </svg>
            </div>
            <input type="text" id="doctorSearch" placeholder="Search by doctor name or specialty..." 
                class="block w-full pl-10 pr-3 py-4 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#217a74] focus:border-[#217a74] transition-all sm:text-sm shadow-sm">
        </div>

        <div id="doctorList" class="grid gap-4 sm:grid-cols-2">
            <?php foreach ($doctors as $doctor): ?>
            <?php 
                $name = $doctor['name'] ?? 'Unknown Doctor';
                $businessName = $doctor['businessName'] ?? $name;
                $specialty = $doctor['primaryCategory'] ?? 'Specialist';
                $rating = isset($doctor['averageRating']) ? number_format($doctor['averageRating'], 1) : 'N/A';
                $reviews = $doctor['totalReviewCount'] ?? 0;
            ?>
            <a href="doctor-details.php?name=<?php echo urlencode($businessName); ?>" 
               class="doctor-card bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all duration-200 block group"
               data-name="<?php echo strtolower($name); ?>"
               data-specialty="<?php echo strtolower($specialty); ?>">
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 group-hover:text-[#217a74] transition-colors"><?php echo $name; ?></h3>
                        <p class="text-sm text-gray-500 mt-1"><?php echo $specialty; ?></p>
                        
                        <div class="flex items-center mt-3 space-x-2">
                            <div class="flex items-center text-yellow-500">
                                <svg class="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                <span class="ml-1 text-sm font-semibold text-gray-700"><?php echo $rating; ?></span>
                            </div>
                            <span class="text-xs text-gray-400">•</span>
                            <span class="text-xs text-gray-500"><?php echo $reviews; ?> reviews</span>
                        </div>
                    </div>
                    <div class="p-2 bg-gray-50 rounded-full group-hover:bg-[#217a74]/10 transition-colors">
                        <svg class="h-5 w-5 text-gray-400 group-hover:text-[#217a74]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </a>
            <?php endforeach; ?>
        </div>

        <div id="noResults" class="hidden text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No doctors found</h3>
            <p class="mt-1 text-sm text-gray-500">Try adjusting your search terms.</p>
        </div>
    </div>

    <script>
        const searchInput = document.getElementById('doctorSearch');
        const doctorCards = document.querySelectorAll('.doctor-card');
        const doctorList = document.getElementById('doctorList');
        const noResults = document.getElementById('noResults');

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            let count = 0;

            doctorCards.forEach(card => {
                const name = card.getAttribute('data-name');
                const specialty = card.getAttribute('data-specialty');
                
                if (name.includes(term) || specialty.includes(term)) {
                    card.classList.remove('hidden');
                    count++;
                } else {
                    card.classList.add('hidden');
                }
            });

            if (count === 0) {
                noResults.classList.remove('hidden');
                doctorList.classList.add('hidden');
            } else {
                noResults.classList.add('hidden');
                doctorList.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>

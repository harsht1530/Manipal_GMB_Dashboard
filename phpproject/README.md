# Manipal GMB Doctor Performance Report (PHP Standalone)

This is a standalone PHP version of the Doctor Performance Report page from the GMB Dashboard. It is designed to be shared via a link.

## Project Structure

- `index.php`: The landing page where you can search and select a doctor.
- `doctor-details.php`: The detailed performance report for a specific doctor.
- `api.php`: Helper functions to fetch data from the existing backend API.
- `config.php`: Configuration for the API base URL and other constants.

## Features

- **Real Data**: Fetches data from the same database as the main dashboard via the API.
- **Interactive Charts**: Replicates the performance trends and rating distribution charts using Highcharts.
- **Tabbed Interface**: Includes Monthly Insights, Keyword Rankings, Competitors, Visuals, and Reviews.
- **Report Downloads**: Support for downloading reports in PDF and data in Excel format.
- **Responsive Design**: Built with Tailwind CSS for a premium, mobile-friendly experience.

## Installation / Hosting

1.  Copy the `phpproject` folder to your PHP-enabled web server (e.g., Apache with PHP 7.4+).
2.  Ensure the server has `curl` enabled in PHP.
3.  The project calls the API at `https://smldatamanagement.multiplierai.co/api`. Ensure the server can make outbound requests to this URL.

## Usage

Access `index.php` to see the list of doctors, or link directly to `doctor-details.php?name=Doctor+Business+Name`.

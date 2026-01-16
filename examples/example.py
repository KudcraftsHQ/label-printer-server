#!/usr/bin/env python3
"""
Example Python integration with Label Printer Server

This example shows how to integrate the label printer API
into a Python application.
"""

import requests
import json
import time

API_URL = 'http://localhost:3000'


def list_printers():
    """List available printers"""
    print('Listing available printers...')
    response = requests.get(f'{API_URL}/printers')
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def connect_printer(vendor_id, product_id):
    """Connect to a printer"""
    print(f'Connecting to printer {vendor_id}:{product_id}...')
    response = requests.post(
        f'{API_URL}/printers/connect',
        json={'vendorId': vendor_id, 'productId': product_id}
    )
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def get_printer_status():
    """Get printer status"""
    print('Getting printer status...')
    response = requests.get(f'{API_URL}/printers/status')
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def print_label(label_data):
    """Print a label"""
    print('Submitting print job...')
    response = requests.post(
        f'{API_URL}/print',
        json=label_data
    )
    result = response.json()
    print(f'Job created: {json.dumps(result, indent=2)}')
    return result


def print_custom_tspl(tspl_commands):
    """Print custom TSPL commands"""
    print('Submitting custom TSPL job...')
    response = requests.post(
        f'{API_URL}/print/custom',
        json={'tspl': tspl_commands}
    )
    result = response.json()
    print(f'Job created: {json.dumps(result, indent=2)}')
    return result


def check_job_status(job_id):
    """Check job status"""
    print(f'Checking job {job_id}...')
    response = requests.get(f'{API_URL}/jobs/{job_id}')
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def list_jobs(status=None, limit=None):
    """List all jobs"""
    print('Listing jobs...')
    params = {}
    if status:
        params['status'] = status
    if limit:
        params['limit'] = limit

    response = requests.get(f'{API_URL}/jobs', params=params)
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def get_queue_stats():
    """Get queue statistics"""
    print('Getting queue statistics...')
    response = requests.get(f'{API_URL}/queue/stats')
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def clear_completed_jobs():
    """Clear completed jobs"""
    print('Clearing completed jobs...')
    response = requests.post(f'{API_URL}/queue/clear')
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


def main():
    """Main example workflow"""
    try:
        print('=== Label Printer API Example ===\n')

        # 1. List printers
        printers = list_printers()
        print('\n---\n')

        # 2. Connect to first printer (if available)
        if printers.get('printers') and len(printers['printers']) > 0:
            printer = printers['printers'][0]
            connect_printer(printer['vendorId'], printer['productId'])
            print('\n---\n')

            # Get printer status
            get_printer_status()
            print('\n---\n')

        # 3. Print a label
        print_job = print_label({
            'pageConfig': 'default',
            'label': {
                'qrData': 'https://example.com/product/ABC-123',
                'title': 'PRODUCT-ABC-123',
                'subtitle': 'Batch: 2026-01-15'
            },
            'quantity': 1
        })
        print('\n---\n')

        # 4. Wait a bit
        time.sleep(2)

        # 5. Check job status
        if print_job.get('job') and print_job['job'].get('id'):
            check_job_status(print_job['job']['id'])
            print('\n---\n')

        # 6. Get queue stats
        get_queue_stats()
        print('\n---\n')

        # 7. List all jobs
        list_jobs(limit=5)

        print('\n=== Example completed ===')

    except requests.exceptions.ConnectionError:
        print('Error: Could not connect to API server.')
        print('Make sure the Label Printer Server is running on port 3000.')
    except Exception as error:
        print(f'Error: {error}')


if __name__ == '__main__':
    main()

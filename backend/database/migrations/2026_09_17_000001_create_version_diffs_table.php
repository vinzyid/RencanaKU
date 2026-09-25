<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cache hasil perhitungan diff antar dua versi PRD (Masalah #8).
     * Sebelumnya endpoint /versions menghitung ulang diff dari nol setiap
     * request; tabel ini menyimpan hasilnya agar cukup dihitung sekali.
     */
    public function up(): void
    {
        Schema::create('version_diffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_version_id')->constrained('prd_versions')->cascadeOnDelete();
            $table->foreignId('to_version_id')->constrained('prd_versions')->cascadeOnDelete();
            $table->longText('diff_data');
            $table->string('algorithm_version')->default('v1');
            $table->timestamps();

            $table->unique(['from_version_id', 'to_version_id', 'algorithm_version'], 'version_diffs_unique');
            $table->index(['from_version_id', 'to_version_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('version_diffs');
    }
};

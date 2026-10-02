<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Jaring pengaman level database untuk race condition penomoran versi PRD
     * (Masalah #3): dua baris tidak boleh punya (project_id, version_number) sama.
     */
    public function up(): void
    {
        Schema::table('prd_versions', function (Blueprint $table) {
            $table->unique(
                ['project_id', 'version_number'],
                'project_version_number_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('prd_versions', function (Blueprint $table) {
            $table->dropUnique('project_version_number_unique');
        });
    }
};

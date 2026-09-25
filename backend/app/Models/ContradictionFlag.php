<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContradictionFlag extends Model
{
    protected $fillable = ['prd_version_id', 'requirement_a', 'requirement_b', 'explanation', 'resolution', 'code'];

    public function prdVersion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(PrdVersion::class);
    }
}